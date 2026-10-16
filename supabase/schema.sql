create extension if not exists "pgcrypto";

create table if not exists clinics (
  id uuid primary key default gen_random_uuid(),
  clinic_name varchar(255) not null,
  doctor_name varchar(255) not null,
  avg_consult_minutes int default 8,
  created_at timestamp with time zone default now()
);

create table if not exists daily_queues (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade,
  queue_date date default current_date,
  current_token_serving int default 0,
  total_tokens_issued int default 0,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists tokens (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references daily_queues(id) on delete cascade,
  token_number int not null,
  patient_name varchar(255) not null default 'Patient',
  patient_phone varchar(20),
  status varchar(50) default 'WAITING',
  issued_at timestamp with time zone default now(),
  served_at timestamp with time zone,
  completed_at timestamp with time zone,
  actual_duration_minutes int
);

alter table clinics enable row level security;
alter table daily_queues enable row level security;
alter table tokens enable row level security;

create policy "public can read active queue data"
on daily_queues for select
using (is_active = true);

create policy "public can read tokens"
on tokens for select
using (true);

create policy "authenticated staff manage queues"
on daily_queues for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated staff manage tokens"
on tokens for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
