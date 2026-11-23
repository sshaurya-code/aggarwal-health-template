-- Investments section (life cover moves here from Insurance), and the International Driving Permit
-- as its own ID type so a person's ordinary licence doesn't count as its renewal.

alter table documents drop constraint documents_category_check;
alter table documents add constraint documents_category_check
  check (category in ('health', 'id', 'bill', 'insurance', 'car', 'other', 'investment'));

alter table documents drop constraint documents_kind_check;
alter table documents add constraint documents_kind_check check (kind in (
  'lab_report', 'prescription', 'imaging', 'discharge', 'consultation', 'vaccination', 'other',
  'aadhaar', 'pan', 'passport', 'driving_licence', 'idp', 'voter_id', 'id_other',
  'bill',
  'health_cover', 'motor_cover', 'life_cover', 'home_cover', 'travel_cover', 'other_cover',
  'rc', 'puc', 'fitness', 'road_tax', 'permit', 'car_other',
  'mutual_fund', 'fixed_deposit', 'recurring_deposit', 'ppf', 'nps', 'invest_other',
  'misc'
));

update documents set category = 'investment' where kind = 'life_cover';
update documents set kind = 'idp' where kind = 'driving_licence' and title ~* '(international|\midp\M)';
