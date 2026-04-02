# 🚀 Hướng dẫn cài đặt & deploy WorkFlow HRM

Thực hiện theo đúng thứ tự các bước dưới đây.
Tổng thời gian: khoảng **30–45 phút** lần đầu.

---

## BƯỚC 1 — Tạo project Supabase (database + auth)

1. Truy cập https://supabase.com → **Start your project** → đăng ký bằng GitHub
2. Nhấn **New project**, điền:
   - **Name**: `hrm-app` (hoặc tuỳ ý)
   - **Database Password**: đặt mật khẩu mạnh, lưu lại
   - **Region**: `Southeast Asia (Singapore)` — gần nhất với Việt Nam
3. Chờ ~2 phút để project khởi động

### Chạy SQL Schema

4. Trong Supabase, vào **SQL Editor** (menu trái) → **New query**
5. Mở file `supabase-schema.sql` trong thư mục project, **copy toàn bộ nội dung**
6. Paste vào SQL Editor → nhấn **RUN**
7. Thấy `Success. No rows returned` là thành công ✅

### Lấy API Keys

8. Vào **Project Settings** (icon bánh răng, menu trái) → **API**
9. Copy 2 giá trị:
   - **Project URL** — dạng `https://abcdefgh.supabase.co`
   - **anon public** key — chuỗi dài bắt đầu bằng `eyJ...`

---

## BƯỚC 2 — Cài đặt project trên máy

### Yêu cầu
- Node.js 18+ (tải tại https://nodejs.org — chọn **LTS**)
- Git (tải tại https://git-scm.com)

### Các bước

```bash
# 1. Di chuyển vào thư mục project
cd hrm-app

# 2. Tạo file .env từ template
cp .env.example .env
```

3. Mở file `.env` bằng Notepad/VSCode, điền 2 giá trị đã copy:
```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

```bash
# 4. Cài dependencies
npm install

# 5. Chạy thử trên máy local
npm run dev
```

6. Mở trình duyệt → http://localhost:5173 — thấy màn hình đăng nhập là OK ✅

---

## BƯỚC 3 — Tạo tài khoản Admin đầu tiên

1. Trong Supabase → **Authentication** → **Users** → **Add user** → **Create new user**
2. Điền email và mật khẩu cho Admin
3. Nhấn **Create user**
4. Vào **SQL Editor** → chạy lệnh sau (thay email đúng của bạn):

```sql
update public.profiles
set role = 'admin', full_name = 'Tên Admin Của Bạn'
where email = 'admin@congty.vn';
```

5. Quay lại app http://localhost:5173 → đăng nhập bằng tài khoản vừa tạo ✅

---

## BƯỚC 4 — Deploy lên Vercel

### 4a. Đưa code lên GitHub

```bash
# Trong thư mục hrm-app
git init
git add .
git commit -m "first commit"
```

1. Truy cập https://github.com → **New repository**
2. Đặt tên `hrm-app` → **Create repository** (để Private nếu muốn bảo mật)
3. Copy lệnh push mà GitHub hiển thị, dán vào terminal:

```bash
git remote add origin https://github.com/TEN_BAN/hrm-app.git
git branch -M main
git push -u origin main
```

### 4b. Deploy trên Vercel

1. Truy cập https://vercel.com → đăng nhập bằng GitHub
2. Nhấn **Add New Project** → chọn repo `hrm-app`
3. Vercel tự nhận đây là Vite project — giữ nguyên cài đặt
4. Mở mục **Environment Variables**, thêm 2 biến:
   - `VITE_SUPABASE_URL` = URL của bạn
   - `VITE_SUPABASE_ANON_KEY` = anon key của bạn
5. Nhấn **Deploy** → chờ ~1 phút
6. Vercel cấp cho bạn URL dạng `hrm-app-abc123.vercel.app` ✅

---

## BƯỚC 5 — Gắn subdomain của bạn (vd: hrm.congty.vn)

### Trên Vercel

1. Vào project → **Settings** → **Domains**
2. Nhập `hrm.congty.vn` → **Add**
3. Vercel hiển thị 1 trong 2 loại record cần tạo:
   - **CNAME**: `hrm` → `cname.vercel-dns.com`
   - hoặc **A record**: `hrm` → IP Vercel cung cấp

### Trên trang quản lý DNS domain của bạn

> Thường là trang hosting/domain bạn đang dùng (Mắt Bão, PA Vietnam, GoDaddy, Cloudflare...)

4. Vào **DNS Management** / **Quản lý DNS**
5. Thêm record theo Vercel yêu cầu:
   - **Type**: CNAME
   - **Name/Host**: `hrm`
   - **Value/Points to**: `cname.vercel-dns.com`
   - **TTL**: 3600 (hoặc Auto)
6. Lưu lại → chờ 5–30 phút để DNS lan truyền
7. Vercel tự cấp SSL certificate miễn phí ✅

---

## BƯỚC 6 — Cấu hình Supabase cho domain thật

1. Trong Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: đổi thành `https://hrm.congty.vn`
3. **Redirect URLs**: thêm `https://hrm.congty.vn/**`
4. Nhấn **Save** ✅

---

## Tạo tài khoản thêm cho nhân viên

Sau khi có app, tạo tài khoản cho nhân viên bằng 1 trong 2 cách:

**Cách 1 — Từ app** (Admin đăng nhập → menu Người dùng → Tạo tài khoản)

**Cách 2 — Từ Supabase** (Authentication → Users → Add user), sau đó set role:
```sql
update public.profiles set role = 'employee', full_name = 'Tên Nhân Viên'
where email = 'nhanvien@congty.vn';
```

---

## Cập nhật app sau này

Mỗi khi sửa code, chỉ cần:
```bash
git add .
git commit -m "mô tả thay đổi"
git push
```
Vercel tự động deploy lại trong ~1 phút ✅

---

## Gặp vấn đề?

| Triệu chứng | Cách xử lý |
|---|---|
| Trang trắng sau đăng nhập | Kiểm tra `.env` đúng URL và key chưa |
| Không lưu được dữ liệu | Kiểm tra đã chạy `supabase-schema.sql` chưa |
| DNS chưa hoạt động | Chờ thêm, kiểm tra lại record trên DNS |
| Lỗi "Invalid login" | Kiểm tra đã tạo user trong Supabase Auth chưa |

---

*WorkFlow HRM — built with React + Supabase + Vercel*
