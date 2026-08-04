## Supabase · Быстрый старт

### 1. Создай проект

<https://supabase.com> → бесплатный тир (500 MB базы + 1 GB хранилища). Этого хватит на тысячи объявлений с фото.

### 2. Примени миграцию

В Supabase Dashboard → SQL Editor → открой и выполни `supabase/migrations/000001_initial_schema.sql`.

Она создаст все таблицы, индексы, RLS-политики и триггеры.

### 3. Настрой хранилище для фото

В SQL Editor выполни отдельно:

```sql
-- Создать бакет для фото объявлений
insert into storage.buckets (id, name, public) values ('listing-images', 'listing-images', true);

-- Разрешить чтение всем
create policy "Anyone can view listing images"
  on storage.objects for select
  using (bucket_id = 'listing-images');

-- Разрешить загрузку авторизованным
create policy "Authenticated can upload listing images"
  on storage.objects for insert
  with check (bucket_id = 'listing-images' and auth.role() = 'authenticated');

-- Разрешить удаление своих файлов
create policy "Users can delete own images"
  on storage.objects for delete
  using (bucket_id = 'listing-images' and auth.uid() = owner);
```

### 4. Настрой Auth

В Authentication → Settings → включи Email-провайдер. Для локальной разработки можно отключить подтверждение email.

### 5. Пропиши ключи

В Settings → API скопируй URL и anon key в `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://твой-проект.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=***
```

### 6. Запускай

```bash
cd sakhalinstay
npm run dev
```

### Что получится

| Таблица | Назначение |
|---|---|
| `profiles` | Пользователи (id = auth.users.id) |
| `listings` | Объявления с полными полями (как в визарде) |
| `listing_images` | Фото объявлений в Supabase Storage |
| `bookings` | Бронирования |
| `messages` | Чат между гостем и хостом |
| `reviews` | Отзывы (1-5 звёзд) |
| `promotions` | Платные продвижения |
| `favorites` | Избранное |
| `banners` | Рекламные баннеры |
| `pending_edits` | Заявки на модерацию правок |
| `help_content` | Контент страницы «Помощь» |

**Плюс:** авторасчёт рейтинга через триггер, реалтайм для броней и сообщений, полнотекстовые индексы на локацию и тип.
