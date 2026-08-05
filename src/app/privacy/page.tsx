import { Metadata } from "next";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — SakhGO",
  description: "Политика обработки персональных данных SakhGO. Какие данные мы собираем, как используем и храним.",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <AuthModal />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="font-display text-3xl mb-2">Политика конфиденциальности</h1>
        <p className="text-sm text-muted-foreground mb-8">Последнее обновление: 6 августа 2026 г.</p>

        <div className="text-sm text-muted-foreground leading-relaxed space-y-6">
          <section>
            <h2 className="font-display text-lg text-foreground mb-2">1. Общие положения</h2>
            <p>Настоящая Политика конфиденциальности (далее — Политика) определяет порядок обработки и защиты персональных данных пользователей платформы SakhGO (далее — Платформа), доступной по адресу sakhgo.ru.</p>
            <p className="mt-2">Используя Платформу, вы даёте согласие на обработку ваших персональных данных в соответствии с настоящей Политикой и Федеральным законом РФ № 152-ФЗ «О персональных данных».</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-2">2. Какие данные мы собираем</h2>
            <p className="font-medium text-foreground mb-1">При регистрации:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Имя и фамилия</li>
              <li>Адрес электронной почты</li>
              <li>Номер телефона</li>
              <li>Пароль (хранится в хешированном виде)</li>
            </ul>
            <p className="font-medium text-foreground mt-3 mb-1">При использовании Платформы:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>История бронирований и сообщений</li>
              <li>Избранные объявления</li>
              <li>Созданные объявления, включая фотографии и описания</li>
              <li>История платежей (без хранения полных платёжных данных)</li>
            </ul>
            <p className="font-medium text-foreground mt-3 mb-1">Технические данные (автоматически):</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>IP-адрес</li>
              <li>Тип и версия браузера</li>
              <li>Файлы cookie</li>
              <li>Время и дата посещения</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-2">3. Цели обработки данных</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Предоставление услуг маркетплейса: связь между гостем и организатором, подтверждение бронирований, уведомления</li>
              <li>Обеспечение работы личного кабинета и истории бронирований</li>
              <li>Улучшение качества сервиса: аналитика посещаемости, популярных направлений</li>
              <li>Предотвращение мошенничества и обеспечение безопасности</li>
              <li>Исполнение требований законодательства РФ</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-2">4. Передача данных третьим лицам</h2>
            <p>Мы не продаём и не передаём ваши персональные данные третьим лицам, за исключением:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Платёжных систем (YooKassa) — только данные, необходимые для проведения платежа</li>
              <li>Государственных органов — в случаях, предусмотренных законодательством РФ</li>
              <li>Контактные данные (телефон) становятся видны организатору и гостю только после подтверждения бронирования</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-2">5. Хранение и защита данных</h2>
            <p>Все персональные данные хранятся на сервере, расположенном на территории Российской Федерации (Сахалинская область).</p>
            <p className="mt-2">Мы применяем следующие меры защиты:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Шифрование данных при передаче (HTTPS/TLS)</li>
              <li>Хеширование паролей (bcrypt)</li>
              <li>Ограниченный доступ к базе данных</li>
              <li>Регулярное обновление программного обеспечения</li>
            </ul>
            <p className="mt-2">Срок хранения данных — пока ваш аккаунт активен. При удалении аккаунта данные удаляются в течение 30 календарных дней.</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-2">6. Файлы cookie</h2>
            <p>Платформа использует сессионные файлы cookie для аутентификации пользователей. Эти cookie необходимы для работы входа в личный кабинет и не используются для отслеживания или рекламы. Без сессионных cookie авторизация на Платформе невозможна.</p>
            <p className="mt-2">Вы можете отключить cookie в настройках браузера, однако это может повлиять на работоспособность авторизации.</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-2">7. Права пользователя</h2>
            <p>В соответствии с Федеральным законом № 152-ФЗ вы имеете право:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Запросить копию ваших персональных данных, хранящихся на Платформе</li>
              <li>Требовать уточнения, блокировки или уничтожения неполных/неточных данных</li>
              <li>Отозвать согласие на обработку персональных данных (что влечёт удаление аккаунта)</li>
              <li>Обжаловать действия Платформы в Роскомнадзоре или в судебном порядке</li>
            </ul>
            <p className="mt-2">Для реализации ваших прав направьте запрос на электронную почту: <a href="mailto:support@sakhgo.ru" className="text-accent hover:underline">support@sakhgo.ru</a>. Мы обязаны ответить в течение 10 рабочих дней.</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-2">8. Изменения политики</h2>
            <p>Платформа оставляет за собой право вносить изменения в настоящую Политику. Актуальная версия всегда доступна по адресу sakhgo.ru/privacy. Существенные изменения сопровождаются уведомлением по электронной почте.</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-2">9. Контактная информация</h2>
            <p>По всем вопросам, связанным с обработкой персональных данных:</p>
            <p className="mt-2"><strong>Email:</strong> <a href="mailto:support@sakhgo.ru" className="text-accent hover:underline">support@sakhgo.ru</a></p>
            <p><strong>Адрес:</strong> Сахалинская область, Российская Федерация</p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
