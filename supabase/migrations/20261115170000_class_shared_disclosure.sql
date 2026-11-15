alter table public.school_recruitment
  drop constraint school_recruitment_information_check,
  add constraint school_recruitment_information_check check (char_length(information) <= 4000);
