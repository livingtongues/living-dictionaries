create trigger handle_updated_at before update on entries
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on senses
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on texts
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on sentences
  for each row execute procedure moddatetime (updated_at);
  
create trigger handle_updated_at before update on photos
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on videos
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on audio
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on speakers
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on dialects
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on tags
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on dictionary_info
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on dictionary_partners
  for each row execute procedure moddatetime (updated_at);