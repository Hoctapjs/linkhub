# LinkHub — Kế hoạch triển khai

> Tài liệu này dành cho agent triển khai. Hãy đọc hết phần "Nguyên tắc" trước khi code, và thực hiện tuần tự theo các Phase. Mỗi Phase có tiêu chí hoàn thành (DoD) — không qua Phase mới khi Phase hiện tại chưa đạt DoD.

## 1. Mục tiêu sản phẩm

Một trang **LinkHub** cá nhân (single-user, không cần đăng nhập) để lưu trữ và truy cập nhanh các đường dẫn. Người dùng có thể:

- **Thêm / Xóa / Sửa** đường dẫn (CRUD đầy đủ).
- **Tìm kiếm + lọc** link theo từ khóa (tiêu đề, URL, mô tả).
- **Phân loại** link bằng categories/tags.
- Tự động lấy **favicon + mô tả** của trang web khi thêm link.
- Click vào link để mở nhanh trong tab mới.

## 2. Tech Stack (đã chốt)

| Lớp | Công nghệ |
|-----|-----------|
| Framework | **Next.js 14+ (App Router)**, TypeScript |
| UI | React + **Tailwind CSS** |
| Backend | Next.js **Route Handlers** (`app/api/...`) |
| Database | **MongoDB** (qua driver chính thức `mongodb`, không cần Mongoose) |
| Icons | `lucide-react` |
| Validation | `zod` |
| Notifications | `react-hot-toast` (hoặc tự viết toast đơn giản) |

> Không thêm auth. Không thêm state-management library (dùng React hooks + fetch). Giữ dependencies tối thiểu.

## 3. Nguyên tắc khi triển khai

1. **TypeScript strict.** Bật `strict: true`.
2. **Single source of truth cho type:** định nghĩa kiểu `Link` ở `lib/types.ts`, dùng chung cho cả client và server.
3. **Validation ở server** bằng `zod` cho mọi input từ client. Không tin client.
4. **Biến môi trường** không hardcode connection string. Dùng `.env.local`, và tạo `.env.example`.
5. **Error handling:** mọi API trả về JSON dạng `{ data }` hoặc `{ error: string }` với HTTP status đúng.
6. **Không chặn UI:** thao tác thêm/sửa/xóa cập nhật optimistic hoặc revalidate sau khi thành công, kèm toast.
7. **Mobile-first responsive.**

## 4. Mô hình dữ liệu

Collection: `links`

```ts
// lib/types.ts
export interface Link {
  _id: string;          // ObjectId dạng string khi trả ra client
  title: string;        // bắt buộc
  url: string;          // bắt buộc, hợp lệ (http/https)
  description?: string;  // tùy chọn, tự lấy hoặc người dùng nhập
  favicon?: string;      // URL favicon, tự lấy
  category?: string;     // 1 category chính (tùy chọn)
  tags: string[];        // mảng tag, mặc định []
  createdAt: string;     // ISO string
  updatedAt: string;     // ISO string
}
```

Zod schema cho input (create/update) ở `lib/validation.ts`:
- `title`: string, 1–200 ký tự.
- `url`: string, phải parse được bằng `new URL()` và protocol http/https.
- `description`: string optional, ≤ 1000 ký tự.
- `category`: string optional, ≤ 50 ký tự.
- `tags`: array string, mỗi tag ≤ 30 ký tự, tối đa 20 tag.

## 5. API (Route Handlers)

| Method | Route | Mô tả |
|--------|-------|-------|
| GET | `/api/links` | Lấy danh sách. Hỗ trợ query `?q=` (search), `?category=`, `?tag=`. Sort theo `createdAt` desc. |
| POST | `/api/links` | Tạo link mới. Body = create schema. Tự fetch metadata (favicon/description) nếu thiếu. |
| GET | `/api/links/[id]` | Lấy 1 link. |
| PUT | `/api/links/[id]` | Cập nhật link. Body = update schema. Cập nhật `updatedAt`. |
| DELETE | `/api/links/[id]` | Xóa link. |
| GET | `/api/metadata?url=` | (Helper) Fetch tiêu đề/mô tả/favicon từ URL để preview khi thêm. |

**Search (`q`)**: dùng regex case-insensitive trên `title`, `url`, `description`. Cân nhắc tạo text index nếu muốn tối ưu (không bắt buộc cho v1).

## 6. Cấu trúc thư mục

```
d:/Link/
├── .env.local                 # MONGODB_URI=... (KHÔNG commit)
├── .env.example               # mẫu biến môi trường
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── app/
│   ├── layout.tsx             # layout gốc + Toaster
│   ├── globals.css            # Tailwind directives
│   ├── page.tsx               # trang chính (server component lấy data ban đầu)
│   └── api/
│       ├── links/
│       │   ├── route.ts        # GET (list), POST (create)
│       │   └── [id]/route.ts   # GET, PUT, DELETE
│       └── metadata/route.ts   # GET metadata helper
├── lib/
│   ├── mongodb.ts             # singleton connection (cache global cho dev hot-reload)
│   ├── types.ts              # interface Link
│   ├── validation.ts         # zod schemas
│   └── metadata.ts           # hàm fetch favicon + og:description từ URL
└── components/
    ├── LinkCard.tsx          # hiển thị 1 link (favicon, title, desc, tags, nút sửa/xóa)
    ├── LinkList.tsx          # grid danh sách, nhận data + xử lý refresh
    ├── LinkForm.tsx          # form thêm/sửa (modal hoặc inline)
    ├── SearchBar.tsx         # ô tìm kiếm
    ├── CategoryFilter.tsx    # filter theo category/tag
    └── ui/                   # (tùy chọn) button, input, modal nhỏ tái sử dụng
```

## 7. Chi tiết kỹ thuật quan trọng

### 7.1 Kết nối MongoDB (`lib/mongodb.ts`)
Dùng pattern singleton chuẩn của Next.js để tránh tạo nhiều connection khi hot-reload:
- Đọc `process.env.MONGODB_URI`, throw nếu thiếu.
- Cache `MongoClient` vào `global` trong môi trường `development`.
- Export hàm `getDb()` trả về database (tên DB ví dụ `linkhub`).

### 7.2 Fetch metadata (`lib/metadata.ts`)
Hàm `fetchMetadata(url)`:
- `fetch` HTML của URL (kèm timeout ~5s, header User-Agent).
- Parse `<title>`, `og:title`, `og:description`, `meta[name=description]` (dùng regex đơn giản hoặc `cheerio` — ưu tiên không thêm dep, dùng regex).
- Favicon: thử `og:image` → `<link rel=icon>` → fallback `https://www.google.com/s2/favicons?domain=<host>&sz=64`.
- Phải bọc try/catch: nếu fail thì trả về object rỗng, KHÔNG làm hỏng việc tạo link. Favicon luôn có fallback theo domain.

### 7.3 Trang chính (`app/page.tsx`)
- Server component: lấy danh sách link ban đầu trực tiếp từ DB (hoặc fetch API) để render nhanh.
- Truyền xuống client component `LinkList` để xử lý tương tác.
- Layout: header (tên app + nút "Thêm link"), SearchBar + CategoryFilter, grid LinkCard.

### 7.4 UX
- Nút "Thêm link" mở `LinkForm` (modal). Khi dán URL, gọi `/api/metadata` để auto-fill title/description/favicon (có thể sửa lại).
- Mỗi LinkCard: click vào → mở URL ở tab mới (`target=_blank` + `rel=noopener noreferrer`). Nút sửa/xóa riêng (không trigger mở link).
- Xóa: confirm trước khi xóa.
- Empty state: khi chưa có link, hiển thị hướng dẫn thêm link đầu tiên.
- Loading & error states rõ ràng.

## 8. Các Phase triển khai (làm tuần tự)

### Phase 0 — Khởi tạo dự án
- `npx create-next-app@latest` tại `d:/Link` với: TypeScript, Tailwind, App Router, ESLint, alias `@/*`.
- Cài deps: `mongodb zod lucide-react react-hot-toast`.
- Tạo `.env.local` + `.env.example` (`MONGODB_URI`), thêm `.env.local` vào `.gitignore`.
- **DoD:** `npm run dev` chạy được, trang mặc định hiển thị ở localhost:3000.

### Phase 1 — Hạ tầng dữ liệu
- Viết `lib/mongodb.ts`, `lib/types.ts`, `lib/validation.ts`.
- Viết `lib/metadata.ts`.
- **DoD:** kết nối được MongoDB (test bằng 1 route tạm hoặc script), không lỗi type.

### Phase 2 — API CRUD
- `app/api/links/route.ts` (GET list + filter/search, POST create).
- `app/api/links/[id]/route.ts` (GET, PUT, DELETE).
- `app/api/metadata/route.ts`.
- **DoD:** test toàn bộ endpoint bằng REST client/curl: tạo, đọc, sửa, xóa, search, filter đều đúng; validation trả lỗi 400 hợp lý.

### Phase 3 — UI cơ bản (đọc + tạo)
- `app/page.tsx`, `app/layout.tsx`, `LinkList`, `LinkCard`, `LinkForm`.
- Hiển thị danh sách, thêm link mới với auto-fill metadata.
- **DoD:** thêm link qua UI và thấy nó xuất hiện; favicon hiển thị.

### Phase 4 — Sửa / Xóa + Search/Filter
- Sửa qua `LinkForm` (chế độ edit), xóa có confirm.
- `SearchBar` + `CategoryFilter` (lọc theo category và tag), nối với query API.
- **DoD:** mọi thao tác CRUD + search + filter hoạt động end-to-end qua UI.

### Phase 5 — Hoàn thiện
- Responsive, empty/loading/error states, toast thông báo.
- README hướng dẫn cài đặt + chạy + biến môi trường.
- **DoD:** chạy mượt trên mobile & desktop; README đầy đủ; `npm run build` không lỗi.

## 9. Tiêu chí nghiệm thu tổng thể

- [ ] Thêm / sửa / xóa link hoạt động và persist vào MongoDB.
- [ ] Search theo từ khóa + filter theo category/tag.
- [ ] Tự lấy favicon + mô tả khi thêm link (có fallback khi fail).
- [ ] Không có lỗi TypeScript, `npm run build` thành công.
- [ ] Validation server-side đầy đủ.
- [ ] README + `.env.example` có sẵn để người khác chạy lại.

## 10. Ngoài phạm vi v1 (không làm trừ khi yêu cầu)

- Đăng nhập / nhiều người dùng.
- Drag-and-drop sắp xếp, import/export, bookmark sync.
- Pagination (v1 cho rằng số link nhỏ; thêm sau nếu cần).
