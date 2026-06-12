# LinkHub — Kế hoạch bổ sung tính năng Người dùng (Multi-user Auth)

> Tài liệu này dành cho **agent triển khai**. Đọc hết phần "0. Bối cảnh & Nguyên tắc" trước khi code, sau đó làm tuần tự theo từng Phase. Mỗi Phase có tiêu chí hoàn thành (DoD) — không qua Phase mới khi Phase hiện tại chưa đạt DoD.

---

## 0. Bối cảnh & Nguyên tắc

### 0.1 Hiện trạng
App LinkHub hiện là **single-user, KHÔNG có auth**. Mọi link nằm chung collection `links`, không gắn với người dùng nào. Stack: Next.js **16.2.9** (App Router), React **19.2.4**, TypeScript strict, MongoDB driver chính thức (không Mongoose), Tailwind v4, zod v4, react-hot-toast.

### 0.2 Mục tiêu
Biến LinkHub thành **multi-user**: mỗi người dùng đăng ký/đăng nhập và **chỉ thấy + thao tác link của chính mình**.

### 0.3 Quyết định đã chốt (KHÔNG tự đổi)
| Hạng mục | Quyết định |
|----------|-----------|
| Phương thức xác thực | **Email + mật khẩu** (chưa làm OAuth) |
| Thư viện | **Auth.js / NextAuth v5** (`next-auth@beta`) |
| Session strategy | **JWT** (bắt buộc khi dùng Credentials provider) |
| Hash mật khẩu | **bcryptjs** |
| Dữ liệu link cũ | **Migrate**: tạo 1 user admin và gán toàn bộ link hiện có cho user đó |

### 0.4 Nguyên tắc bắt buộc
1. ⚠️ **Đây KHÔNG phải Next.js bạn từng biết.** Trước khi viết code Next, ĐỌC tài liệu trong `node_modules/next/dist/docs/` — đặc biệt:
   - `01-app/02-guides/authentication.md`
   - `01-app/01-getting-started/15-route-handlers.md`
   - `01-app/01-getting-started/07-mutating-data.md` (Server Actions)
   - `01-app/03-api-reference/03-file-conventions/` (middleware, layout)
   Heed mọi deprecation notice.
2. **Kiểm tra tương thích Auth.js v5 với Next 16 / React 19** trước khi cài: đọc README của `next-auth` sau khi cài và đối chiếu doc. Nếu API khác doc dưới đây, **ưu tiên doc/README thực tế trong `node_modules`**, và cập nhật lại file này.
3. **TypeScript strict.** Không `any` trừ khi bất khả kháng.
4. **Single source of truth cho type** ở `lib/types.ts`.
5. **Validation server-side bằng zod** cho mọi input (đăng ký, đăng nhập).
6. **KHÔNG hardcode secret.** Mọi biến qua `.env.local`, cập nhật `.env.example`.
7. **Bảo mật dữ liệu:** MỌI truy vấn tới collection `links` PHẢI lọc theo `ownerId` của user đang đăng nhập. Không bao giờ tin `ownerId` gửi từ client.
8. **Không phá vỡ tính năng hiện có** (CRUD, search, filter, metadata, AI notes) — chỉ thêm lớp user lên trên.

---

## 1. Mô hình dữ liệu

### 1.1 Collection mới: `users`
```ts
// lib/types.ts
export interface User {
  _id: string;          // ObjectId -> string khi trả client
  email: string;        // unique, lowercase
  name?: string;        // tên hiển thị, tùy chọn
  passwordHash: string; // bcrypt hash — TUYỆT ĐỐI không trả ra client
  createdAt: string;    // ISO
  updatedAt: string;    // ISO
}

// Kiểu an toàn để trả ra client (không có passwordHash)
export type PublicUser = Pick<User, '_id' | 'email' | 'name' | 'createdAt'>;
```
- Tạo **unique index** trên `email`: `db.collection('users').createIndex({ email: 1 }, { unique: true })`. Đặt việc tạo index trong một helper chạy idempotent (xem 4.1).

### 1.2 Sửa interface `Link`
Thêm trường `ownerId`:
```ts
export interface Link {
  _id: string;
  ownerId: string;      // ObjectId(user) dạng string — MỚI, bắt buộc
  title: string;
  // ... các trường cũ giữ nguyên
}
```
- Tạo index `db.collection('links').createIndex({ ownerId: 1, createdAt: -1 })` để list nhanh.

---

## 2. Auth.js (NextAuth v5) — cấu hình

> Tham khảo `node_modules/next-auth` README sau khi cài. Dưới đây là khung dự kiến cho v5; điều chỉnh theo API thực tế.

### 2.1 Dependencies cần cài
```
npm i next-auth@beta bcryptjs
npm i -D @types/bcryptjs
```

### 2.2 Biến môi trường (thêm vào `.env.local` và `.env.example`)
```
AUTH_SECRET=...        # tạo bằng: npx auth secret  (hoặc openssl rand -base64 32)
# MONGODB_URI và GROQ_API_KEY giữ nguyên
```

### 2.3 File cấu hình auth — `lib/auth.ts` (hoặc `auth.ts` ở root)
- Khởi tạo NextAuth với:
  - `session: { strategy: 'jwt' }` (BẮT BUỘC với Credentials provider).
  - **Credentials provider**: `authorize(credentials)` →
    1. validate `email`/`password` bằng zod (`loginSchema`).
    2. tìm user theo email (lowercase) trong Mongo.
    3. `bcrypt.compare(password, user.passwordHash)`.
    4. nếu hợp lệ → trả `{ id: user._id.toString(), email, name }`; sai → trả `null` (KHÔNG ném lỗi lộ thông tin).
  - `callbacks.jwt`: nhét `token.id = user.id` khi đăng nhập.
  - `callbacks.session`: gán `session.user.id = token.id`.
  - `pages: { signIn: '/login' }`.
- Export `{ handlers, auth, signIn, signOut }`.

### 2.4 Route handler — `app/api/auth/[...nextauth]/route.ts`
```ts
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

### 2.5 Mở rộng type session
Tạo `types/next-auth.d.ts` để khai báo `session.user.id: string` cho TypeScript.

---

## 3. Đăng ký (Register)

NextAuth không lo phần tạo tài khoản — ta tự làm:

- **`lib/validation.ts`**: thêm
  - `registerSchema`: `email` (z.email), `password` (min 8, max 100), `name` optional (max 80).
  - `loginSchema`: `email`, `password`.
- **`app/api/register/route.ts`** (POST):
  1. validate body bằng `registerSchema`.
  2. chuẩn hóa email = lowercase + trim.
  3. kiểm tra email đã tồn tại chưa → nếu có, trả `409`.
  4. `bcrypt.hash(password, 10)`.
  5. insert user `{ email, name, passwordHash, createdAt, updatedAt }`.
  6. trả `201` với `PublicUser` (KHÔNG kèm passwordHash). KHÔNG tự đăng nhập ở đây — để client gọi `signIn` sau, hoặc redirect sang `/login`.
  7. Bắt lỗi duplicate key (E11000) → trả `409` thay vì `500`.

---

## 4. Hạ tầng dữ liệu cần sửa

### 4.1 `lib/mongodb.ts`
- Thêm helper `getUsersCollection()` / `getLinksCollection()` (tùy chọn, cho gọn).
- Thêm hàm `ensureIndexes()` chạy idempotent (tạo unique index email + index ownerId). Gọi 1 lần khi khởi động hoặc lazy trong getDb (cẩn thận để không chạy mỗi request — dùng cờ global đã-chạy).

### 4.2 Helper lấy user hiện tại — `lib/session.ts`
- `getCurrentUserId(): Promise<string | null>` dùng `auth()` từ `lib/auth.ts`, trả `session?.user?.id ?? null`.
- Dùng trong mọi route handler của links + ai-notes.

---

## 5. Bảo vệ & scope API (PHẦN QUAN TRỌNG NHẤT)

Mọi endpoint thao tác dữ liệu phải yêu cầu đăng nhập và lọc theo `ownerId`. Trả `401` nếu chưa đăng nhập.

| File | Thay đổi bắt buộc |
|------|-------------------|
| `app/api/links/route.ts` — **GET** | Lấy `ownerId`; nếu null → 401. Thêm `{ ownerId }` vào `mongoFilter` (gộp với `$and` hiện có). |
| `app/api/links/route.ts` — **POST** | 401 nếu chưa login. Khi insert, set `ownerId` = user hiện tại (KHÔNG lấy từ body). |
| `app/api/links/[id]/route.ts` — **GET/PUT/DELETE** | 401 nếu chưa login. Mọi `findOne`/`findOneAndUpdate`/`deleteOne` thêm điều kiện `{ _id, ownerId }`. Như vậy user A không đọc/sửa/xóa được link của user B (sẽ ra 404). |
| `app/api/ai-notes/route.ts` — **POST** | 401 nếu chưa login (tránh lạm dụng quota AI). Không cần ownerId vì không đụng DB. |
| `app/api/metadata/route.ts` | Yêu cầu đăng nhập (401 nếu chưa) để tránh dùng làm proxy fetch tùy ý. |
| `app/api/test/route.ts`, `app/api/test-db/route.ts` | Cân nhắc xóa hoặc chặn ở production (đây là route test, không nên expose). |

> ⚠️ Khi thêm `ownerId` vào query update/delete, đảm bảo so sánh đúng kiểu: `ownerId` lưu trong DB là **string** (theo model ở mục 1.2). Thống nhất luôn lưu/so sánh dạng string để tránh lệch ObjectId vs string.

---

## 6. Middleware bảo vệ trang — `middleware.ts` (root)

- Dùng `auth` từ NextAuth làm middleware để chặn truy cập trang chính khi chưa đăng nhập.
- `matcher`: bảo vệ `/` (trang links). **Loại trừ** `/login`, `/register`, `/api/auth/*`, `/api/register`, static assets (`_next`, favicon...).
- Chưa đăng nhập mà vào `/` → redirect `/login`. Đã đăng nhập mà vào `/login` hoặc `/register` → redirect `/`.
- Tham khảo doc middleware trong `node_modules/next/dist/docs/` cho cú pháp Next 16.

---

## 7. UI

### 7.1 Trang đăng nhập — `app/login/page.tsx`
- Form email + password. Submit gọi `signIn('credentials', { email, password, redirect: ... })` (client component, dùng `signIn` từ `next-auth/react`).
- Hiển thị lỗi "Email hoặc mật khẩu không đúng" khi thất bại (không lộ chi tiết).
- Link sang `/register`. Toast khi lỗi.

### 7.2 Trang đăng ký — `app/register/page.tsx`
- Form name (optional) + email + password (+ confirm password — validate phía client).
- Submit → `POST /api/register`. Thành công → tự `signIn` rồi redirect `/`, hoặc redirect `/login` kèm toast "Đăng ký thành công".
- Link sang `/login`.

### 7.3 Layout & Header
- **`app/layout.tsx`**: bọc `children` bằng `<SessionProvider>` (từ `next-auth/react`) nếu cần session ở client component. Giữ `ToasterProvider`.
- **`app/page.tsx` (header)**: thêm khu vực user góc phải — hiển thị email/tên + nút **Đăng xuất** (`signOut`). Có thể tách thành `components/UserMenu.tsx`.
- Trang `/login` và `/register` nên có layout tối giản (không cần header app). Cân nhắc route group `(auth)` để tách layout.

### 7.4 Component mới gợi ý
- `components/AuthForm.tsx` (dùng chung login/register) hoặc tách riêng `LoginForm` / `RegisterForm`.
- `components/UserMenu.tsx`.

---

## 8. Migration dữ liệu cũ → user admin

Tạo script `scripts/migrate-add-owner.ts` (chạy bằng `node`/`tsx`, hoặc tạm thời 1 route admin có bảo vệ rồi xóa):

1. Đọc `MONGODB_URI`.
2. Tạo (hoặc tìm) user admin từ biến môi trường: `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Hash password, upsert vào `users`.
3. `updateMany({ ownerId: { $exists: false } }, { $set: { ownerId: <adminId> } })` trên collection `links`.
4. In ra số document đã cập nhật.
5. Idempotent: chạy lại không nhân đôi user, không ghi đè link đã có owner.

> Ghi rõ trong README cách chạy migration MỘT LẦN sau khi deploy code mới.

---

## 9. Cấu trúc thư mục sau khi xong (phần thêm/sửa)

```
d:/linkhub/
├── auth.ts  hoặc  lib/auth.ts        # cấu hình NextAuth          [MỚI]
├── middleware.ts                      # bảo vệ route               [MỚI]
├── types/next-auth.d.ts              # mở rộng type session       [MỚI]
├── scripts/migrate-add-owner.ts      # migration                  [MỚI]
├── app/
│   ├── layout.tsx                    # + SessionProvider          [SỬA]
│   ├── page.tsx                      # + UserMenu/logout          [SỬA]
│   ├── login/page.tsx                #                            [MỚI]
│   ├── register/page.tsx             #                            [MỚI]
│   └── api/
│       ├── auth/[...nextauth]/route.ts  #                         [MỚI]
│       ├── register/route.ts            #                         [MỚI]
│       ├── links/route.ts               # scope ownerId           [SỬA]
│       ├── links/[id]/route.ts          # scope ownerId           [SỬA]
│       ├── ai-notes/route.ts            # + auth guard            [SỬA]
│       └── metadata/route.ts            # + auth guard            [SỬA]
├── lib/
│   ├── auth.ts (nếu đặt ở lib)
│   ├── session.ts                    # getCurrentUserId           [MỚI]
│   ├── types.ts                      # + User, PublicUser, ownerId [SỬA]
│   ├── validation.ts                 # + register/login schema    [SỬA]
│   └── mongodb.ts                    # + indexes/helpers          [SỬA]
└── components/
    ├── UserMenu.tsx                  #                            [MỚI]
    └── LoginForm.tsx / RegisterForm.tsx (hoặc AuthForm)           [MỚI]
```

---

## 10. Các Phase triển khai (làm tuần tự)

### Phase 0 — Chuẩn bị & nghiên cứu
- Đọc các doc Next ở mục 0.4. Cài `next-auth@beta`, `bcryptjs`, `@types/bcryptjs`.
- Đọc README của `next-auth` trong `node_modules`, đối chiếu API v5 với plan này; ghi chú khác biệt.
- Tạo `AUTH_SECRET`, cập nhật `.env.local` + `.env.example`.
- **DoD:** deps cài xong, `npm run dev` vẫn chạy, đã xác nhận API NextAuth v5 thực tế.

### Phase 1 — Model & validation
- Sửa `lib/types.ts` (User, PublicUser, `ownerId` trên Link).
- Sửa `lib/validation.ts` (registerSchema, loginSchema).
- Thêm `ensureIndexes()` + helper trong `lib/mongodb.ts`.
- **DoD:** không lỗi type; index tạo được khi gọi helper.

### Phase 2 — Auth core
- Viết `lib/auth.ts` (Credentials provider + JWT callbacks).
- `app/api/auth/[...nextauth]/route.ts`, `types/next-auth.d.ts`.
- `app/api/register/route.ts` + `lib/session.ts`.
- **DoD:** đăng ký user qua `POST /api/register` (curl) tạo được user có passwordHash; gọi đăng nhập qua NextAuth thành công, sai mật khẩu trả về thất bại; `auth()` đọc được userId.

### Phase 3 — Scope & bảo vệ API
- Thêm auth guard + lọc `ownerId` vào tất cả route ở mục 5.
- **DoD (test bằng 2 user A, B):** A chỉ thấy link của A; A không GET/PUT/DELETE được link của B (404); POST tạo link gắn đúng ownerId; chưa đăng nhập → mọi route trả 401.

### Phase 4 — UI auth
- `app/login/page.tsx`, `app/register/page.tsx`, `middleware.ts`.
- `app/layout.tsx` (+SessionProvider), header + `UserMenu` (đăng xuất).
- **DoD:** end-to-end qua trình duyệt — đăng ký → đăng nhập → thấy link của mình → đăng xuất → bị chặn về `/login`. Vào `/` khi chưa login bị redirect.

### Phase 5 — Migration & hoàn thiện
- Viết + chạy `scripts/migrate-add-owner.ts` gán link cũ cho admin.
- Xử lý route test (`/api/test`, `/api/test-db`).
- Cập nhật `README` (đăng ký/đăng nhập, biến môi trường mới, cách chạy migration).
- **DoD:** link cũ hiển thị dưới tài khoản admin; `npm run build` không lỗi; README đầy đủ.

---

## 11. Tiêu chí nghiệm thu tổng thể
- [ ] Đăng ký, đăng nhập, đăng xuất hoạt động (email + mật khẩu).
- [ ] Mật khẩu lưu dạng **bcrypt hash**, không bao giờ trả ra client.
- [ ] Mỗi user chỉ thấy & thao tác **link của mình**; cách ly chéo giữa các user (kiểm chứng bằng 2 tài khoản).
- [ ] Mọi API links/ai-notes/metadata yêu cầu đăng nhập (401 nếu chưa).
- [ ] Trang chính được middleware bảo vệ; chưa login → `/login`.
- [ ] Link cũ đã migrate về tài khoản admin.
- [ ] Không lỗi TypeScript; `npm run build` thành công.
- [ ] `.env.example` cập nhật `AUTH_SECRET`; README hướng dẫn chạy lại được.

---

## 12. Ngoài phạm vi lần này (không làm trừ khi được yêu cầu)
- OAuth / đăng nhập mạng xã hội (Google, GitHub).
- Quên mật khẩu / xác minh email / đổi mật khẩu.
- Phân quyền vai trò (admin/role), chia sẻ link giữa users, link công khai.
- Rate limiting, 2FA.

---

## 13. Bẫy cần tránh (Next 16 / Auth.js v5)
- **Credentials provider bắt buộc `session.strategy = 'jwt'`** — không dùng database session được.
- `params` trong route handler là **Promise** (`await params`) — code hiện tại đã đúng, giữ pattern này.
- Auth.js v5 dùng biến `AUTH_SECRET` (không phải `NEXTAUTH_SECRET` của v4).
- Không gọi `ensureIndexes()` mỗi request — dùng cờ global.
- `signIn`/`signOut` từ `next-auth/react` dùng ở **client component**; `auth()` (server) dùng trong route handler/server component.
- Khi so sánh `ownerId`: thống nhất **string** ở cả lưu trữ lẫn query, tránh lệch ObjectId.
