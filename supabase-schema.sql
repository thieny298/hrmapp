-- ============================================================
-- WORKFLOW HRM — Supabase Schema
-- Chạy toàn bộ file này trong Supabase > SQL Editor > New Query
-- ============================================================

-- 1. PROFILES (mở rộng từ auth.users)
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text,
  full_name   text,
  role        text not null default 'employee' check (role in ('admin', 'manager', 'employee')),
  created_at  timestamptz default now()
);

-- Tự động tạo profile khi có user mới đăng ký
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'employee'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. EMPLOYEES
create table public.employees (
  id          uuid default gen_random_uuid() primary key,
  full_name   text not null,
  department  text,
  position    text,
  status      text default 'active' check (status in ('active', 'probation', 'leave', 'quit')),
  email       text,
  phone       text,
  join_date   date,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);


-- 3. CUSTOMERS
create table public.customers (
  id              uuid default gen_random_uuid() primary key,
  name            text not null,
  contact_name    text,
  email           text,
  phone           text,
  status          text default 'prospect' check (status in ('active', 'prospect', 'inactive')),
  contract_value  text,
  industry        text,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);


-- 4. TASKS
create table public.tasks (
  id          uuid default gen_random_uuid() primary key,
  title       text not null,
  description text,
  status      text default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  priority    text default 'medium' check (priority in ('high', 'medium', 'low')),
  assigned_to uuid references public.profiles(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  due_date    date,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);


-- 5. ROW LEVEL SECURITY (RLS)

alter table public.profiles  enable row level security;
alter table public.employees enable row level security;
alter table public.customers enable row level security;
alter table public.tasks     enable row level security;


-- PROFILES policies
create policy "Users can read all profiles"
  on public.profiles for select
  to authenticated using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated using (auth.uid() = id);

create policy "Admin can update all profiles"
  on public.profiles for update
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- EMPLOYEES policies
create policy "Admin and manager can read employees"
  on public.employees for select
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager'))
  );

create policy "Admin and manager can insert employees"
  on public.employees for insert
  to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager'))
  );

create policy "Admin and manager can update employees"
  on public.employees for update
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager'))
  );

create policy "Only admin can delete employees"
  on public.employees for delete
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- CUSTOMERS policies
create policy "Admin and manager can read customers"
  on public.customers for select
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager'))
  );

create policy "Admin and manager can insert customers"
  on public.customers for insert
  to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager'))
  );

create policy "Admin and manager can update customers"
  on public.customers for update
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager'))
  );

create policy "Only admin can delete customers"
  on public.customers for delete
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- TASKS policies
create policy "Employees see only their tasks"
  on public.tasks for select
  to authenticated using (
    assigned_to = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager'))
  );

create policy "Admin and manager can insert tasks"
  on public.tasks for insert
  to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager'))
  );

create policy "Admin and manager can update any task"
  on public.tasks for update
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager'))
  );

create policy "Employee can update own task status"
  on public.tasks for update
  to authenticated using (assigned_to = auth.uid());

create policy "Only admin can delete tasks"
  on public.tasks for delete
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- 6. DỮ LIỆU MẪU (tuỳ chọn — xoá nếu không cần)

insert into public.customers (name, contact_name, email, status, industry) values
  ('TechCorp Vietnam', 'Nguyễn Hải Long', 'long@techcorp.vn', 'active', 'Công nghệ'),
  ('StartupXYZ', 'Phan Thị Mai', 'mai@startupxyz.vn', 'prospect', 'E-commerce'),
  ('Công ty ABC', 'Võ Đức Thắng', 'thang@abc.vn', 'inactive', 'Sản xuất');

-- ============================================================
-- XONG! Tiếp theo: tạo tài khoản Admin đầu tiên theo hướng dẫn
-- ============================================================
