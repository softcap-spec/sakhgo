# ЮKassa — интеграция оплаты продвижения

## Новые файлы

| Файл | Что делает |
|---|---|
| `migrations/012_yookassa_payments.sql` | Добавляет колонки `payment_id`, `idempotency_key`, `payment_url`, `paid_at`, `refunded_at` в `promotions`; создаёт таблицу `payment_events` для идемпотентности вебхуков |
| `src/app/api/payments/create/route.ts` | Шаг 2 флоу: создаёт платёж в ЮKassa, возвращает `paymentUrl` |
| `src/app/api/payments/webhook/route.ts` | Принимает события от ЮKassa, проверяет IP, идемпотентен, активирует промо |

## Изменённые файлы

| Файл | Изменения |
|---|---|
| `src/lib/db.ts` | Добавлен `dbInitPromoPayment`; `dbCreatePromotion` теперь создаёт с `status='draft'` |
| `src/lib/api.ts` | Добавлены `apiInitPromoPayment`, `apiCreatePayment` |
| `src/app/api/store/route.ts` | Добавлен `case "initPromoPayment"` в `OWNER_PARAM` + switch |
| `src/components/promote-modal.tsx` | Полный переход на двухшаговый платёжный флоу, убран `onApply` |
| `src/app/dashboard/page.tsx` | Убраны `handlePromoApply` и `onApply` |
| `src/app/dashboard/host/page.tsx` | Убраны `handlePromoApply` и `onApply` |

## Применение

```bash
# Патч одной командой (из корня репозитория):
git apply yookassa.patch

# Или скопируйте файлы вручную (пути совпадают 1:1 с репозиторием)

# Миграция БД:
psql $DATABASE_URL -f migrations/012_yookassa_payments.sql
```

## Переменные окружения (добавить в .env)

```
YOOKASSA_SHOP_ID=ваш_shopId_из_кабинета_ЮKassa
YOOKASSA_SECRET=ваш_секретный_ключ_из_кабинета_ЮKassa
NEXT_PUBLIC_BASE_URL=https://sakhgo.ru
```

## Настройка вебхука в кабинете ЮKassa

1. Личный кабинет → Интеграция → HTTP-уведомления
2. URL: `https://sakhgo.ru/api/payments/webhook`
3. События: `payment.succeeded`, `payment.canceled`, `refund.succeeded`

## Флоу оплаты

```
Хост нажимает «Продвинуть»
  → promote-modal показывает выбор типа и срока
  → нажимает «Оплатить через ЮKassa»
  → POST /api/store {action:"initPromoPayment"} → создаёт promotions (status=draft)
  → POST /api/payments/create {promotionId}    → создаёт платёж в ЮKassa API
  → redirect на paymentUrl (страница оплаты ЮKassa)
  → хост платит картой / СБП
  → ЮKassa POST /api/payments/webhook {event:"payment.succeeded"}
  → сервер проверяет IP + идемпотентность + верифицирует статус через ЮKassa API
  → promotions.status = 'active', listings.promo = тип
  → хост видит активное продвижение в личном кабинете
```

## Чек «Мой налог»

Формировать вручную в приложении «Мой налог» после каждой оплаты.
Если объём вырастет — подключить API ФНС «Мой налог» отдельно.
