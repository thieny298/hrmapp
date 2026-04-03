-- ============================================================
-- OPTWAYS HRM v2 — Supabase Schema
-- Chạy trong Supabase > SQL Editor > New Query
-- ============================================================

-- (Giữ nguyên các bảng cũ: profiles, employees, customers, tasks)
-- Thêm các bảng mới bên dưới

-- 1. EMPLOYEE PROFILES (hồ sơ chi tiết)
create table if not exists public.employee_profiles (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete cascade unique,
  employee_code   text,
  status          text default 'active',
  position        text,
  department      text,
  join_date       date,
  email           text,
  phone           text,
  dob             date,
  gender          text,
  marital_status  text,
  hometown        text,
  education_level text,
  ethnicity       text,
  religion        text,
  current_address text,
  permanent_address text,
  tax_code        text,
  bank_account    text,
  bank_name       text,
  bank_branch     text,
  bank_owner      text,
  id_number       text,
  id_issued_date  date,
  id_issued_place text,
  notes           text,
  education_history jsonb default '[]',
  work_history    jsonb default '[]',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 2. ATTENDANCE (chấm công)
create table if not exists public.attendance (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  date        date not null,
  check_in    time,
  check_out   time,
  status      text default 'present' check (status in ('present','late','absent','leave')),
  note        text,
  device_id   text,
  created_at  timestamptz default now(),
  unique(user_id, date)
);

-- 3. LEAVE REQUESTS (nghỉ phép)
create table if not exists public.leave_requests (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete cascade,
  from_date       date not null,
  to_date         date not null,
  leave_type      text default 'full' check (leave_type in ('full','morning','afternoon')),
  days_count      numeric(4,1) default 1,
  reason          text,
  handover_to     text,
  handover_email  text,
  status          text default 'pending' check (status in ('pending','approved','rejected')),
  approved_by     uuid references public.profiles(id),
  approved_at     timestamptz,
  reject_reason   text,
  created_at      timestamptz default now()
);

-- 4. SALARY RECORDS (bảng lương)
create table if not exists public.salary_records (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references public.profiles(id) on delete cascade,
  period            text not null,
  base_salary       numeric(15,0) default 0,
  allowance         numeric(15,0) default 0,
  bonus             numeric(15,0) default 0,
  social_insurance  numeric(15,0) default 0,
  personal_tax      numeric(15,0) default 0,
  other_deduction   numeric(15,0) default 0,
  net_salary        numeric(15,0) default 0,
  status            text default 'pending' check (status in ('pending','paid')),
  note              text,
  created_at        timestamptz default now()
);

-- 5. HOLIDAYS (ngày lễ)
create table if not exists public.holidays (
  id    uuid default gen_random_uuid() primary key,
  date  date not null unique,
  name  text not null
);

-- Insert ngày lễ Việt Nam cơ bản
insert into public.holidays (date, name) values
  ('2026-01-01', 'Tết Dương lịch'),
  ('2026-02-17', 'Tết Nguyên Đán'),
  ('2026-02-18', 'Tết Nguyên Đán'),
  ('2026-02-19', 'Tết Nguyên Đán'),
  ('2026-02-20', 'Tết Nguyên Đán'),
  ('2026-02-21', 'Tết Nguyên Đán'),
  ('2026-04-30', 'Ngày Giải phóng miền Nam'),
  ('2026-05-01', 'Quốc tế Lao động'),
  ('2026-09-02', 'Quốc khánh')
on conflict (date) do nothing;

-- 6. RLS POLICIES

alter table public.employee_profiles enable row level security;
alter table public.attendance       enable row level security;
alter table public.leave_requests   enable row level security;
alter table public.salary_records   enable row level security;
alter table public.holidays         enable row level security;

-- Employee profiles
create policy "Users can read own profile" on public.employee_profiles for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));

create policy "Users can upsert own profile" on public.employee_profiles for all to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')))
  with check (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));

-- Attendance
create policy "Users see own attendance" on public.attendance for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));

create policy "Users insert own attendance" on public.attendance for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users update own attendance" on public.attendance for update to authenticated
  using (user_id = auth.uid());

-- Leave requests
create policy "Users see own leave" on public.leave_requests for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));

create policy "Users insert own leave" on public.leave_requests for insert to authenticated
  with check (user_id = auth.uid());

create policy "Admin/manager update leave" on public.leave_requests for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));

-- Salary
create policy "Users see own salary" on public.salary_records for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));

create policy "Admin manage salary" on public.salary_records for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Holidays: everyone can read
create policy "Anyone can read holidays" on public.holidays for select to authenticated using (true);
create policy "Admin manage holidays" on public.holidays for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- XONG! Các bảng mới đã được tạo
-- ============================================================
