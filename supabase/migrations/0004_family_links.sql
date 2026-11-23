-- Family tree: who is married to whom, and one parent per child (the other parent is that parent's spouse).
alter table members add column if not exists spouse_id uuid references members(id) on delete set null;
alter table members add column if not exists parent_id uuid references members(id) on delete set null;
