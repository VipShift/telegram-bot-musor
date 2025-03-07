require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const chatId = "-1002499532353"; // ID группы сотрудников

// Храним состояние пользователей при заполнении заявки
const userStates = {};

// Храним отправленные заявки, вместе с message_id (для удаления из группы)
const submittedRequests = {};

// Главное меню с кнопками
const mainMenu = Markup.keyboard([
    ["📩 Подать заявку", "❌ Отменить заявку"],
    ["ℹ️ Инфо", "💬 Служба поддержки"]
]).resize();

// Команда /start
bot.start((ctx) => {
    ctx.reply("👋 Привет! Я бот для подачи заявок на вывоз мусора. Выберите действие:", mainMenu);
});

// Команда /menu - открывает главное меню
bot.command("menu", (ctx) => {
    ctx.reply("📋 Главное меню. Выберите действие:", mainMenu);
});

// Обработчик для кнопки ℹ️ Инфо
bot.hears("ℹ️ Инфо", (ctx) => {
    ctx.reply(
        "ℹ️ *Мы помогаем вам с вывозом мусора.*\n\n" +
        "✅ *Что мы делаем:*\n" +
        "- Быстро и надежно вывозим мусор с вашего адреса.\n" +
        "- Работаем ежедневно, без выходных.\n" +
        "- Соблюдаем все экологические нормы.\n" +
        "- Оперативно реагируем на заявки.\n\n" +
        "🚛 *Как оформить заявку?*\n" +
        "1️⃣ Нажмите \"📩 Подать заявку\".\n" +
        "2️⃣ Введите свой адрес и удобное время вывоза мусора.\n" +
        "3️⃣ Дождитесь подтверждения.\n\n" +
        "⏰ *Важно!* Заявка вступает в силу через 30 минут после подачи.\n\n" +
        "💬 *Если у вас есть вопросы, нажмите \"💬 Служба поддержки\".*",
        { parse_mode: "Markdown" }
    );
});

// Обработчик для кнопки 💬 Служба поддержки
bot.hears("💬 Служба поддержки", (ctx) => {
    ctx.reply(
        "💬 *Свяжитесь с нашей службой поддержки:*\n\n" +
        "📞 *Телефон:* +1234567890\n" +
        "📧 *Email:* support@cleanservice.com\n" +
        "📲 *Telegram:* @SupportChat\n\n" +
        "Мы работаем 24/7 и готовы помочь вам! 😊",
        { parse_mode: "Markdown" }
    );
});

// Начинаем процесс подачи заявки
bot.hears("📩 Подать заявку", (ctx) => {
    const userId = ctx.from.id;
    userStates[userId] = { step: "street" }; // Начинаем с улицы
    ctx.reply("📍 Введите название вашей улицы (например, Ленина):");
});

// Обработчик для кнопки "❌ Отменить заявку"
bot.hears("❌ Отменить заявку", (ctx) => {
    const userId = ctx.from.id;

    // Если заявка в процессе заполнения
    if (userStates[userId]) {
        delete userStates[userId];
        ctx.reply("✅ Ваша незавершённая заявка отменена.");
        return;
    }

    // Если заявка уже отправлена в группу
    if (submittedRequests[userId]) {
        const requestData = submittedRequests[userId];
        delete submittedRequests[userId];

        ctx.reply("✅ Ваша заявка успешно отменена.");

        // Удаляем сообщение с заявкой из группы (если хотим удалять именно сообщение)
        if (requestData.messageId) {
            bot.telegram.deleteMessage(chatId, requestData.messageId)
                .then(() => {
                    // Оповещаем группу о том, что заявка была удалена
                    bot.telegram.sendMessage(
                        chatId,
                        `❌ *Отмена заявки*\n\n👤 Клиент: ${ctx.from.first_name} (@${ctx.from.username || "нет логина"})\n\n*Отменена заявка:*\n📍 Улица: ${requestData.street}\n🏢 Дом: ${requestData.house}\n🏠 Квартира: ${requestData.apartment}\n⏰ Время: ${requestData.time}\n\n✅ Заявка удалена из канала.`,
                        { parse_mode: "Markdown" }
                    );
                })
                .catch((error) => {
                    console.error("Ошибка при удалении сообщения из группы:", error);
                    bot.telegram.sendMessage(chatId, "❌ Не удалось удалить заявку из группы.");
                });
        } else {
            // Если messageId нет, просто оповещаем группу
            bot.telegram.sendMessage(
                chatId,
                `❌ *Отмена заявки*\n\n👤 Клиент: ${ctx.from.first_name} (@${ctx.from.username || "нет логина"})\n\n*Отменена заявка:*\n📍 Улица: ${requestData.street}\n🏢 Дом: ${requestData.house}\n🏠 Квартира: ${requestData.apartment}\n⏰ Время: ${requestData.time}\n\n✅ Заявка удалена из канала.`,
                { parse_mode: "Markdown" }
            );
        }
        return;
    }

    // Если заявок для отмены нет
    ctx.reply("❌ У вас нет активных заявок для отмены.");
});

// Обработка пошагового ввода для подачи заявки
bot.on("text", (ctx) => {
    const userId = ctx.from.id;
    const message = ctx.message.text;
    
    if (userStates[userId]) {
        switch (userStates[userId].step) {
            case "street":
                userStates[userId].street = message;
                userStates[userId].step = "house";
                ctx.reply("🏢 Введите номер дома (например, 10):");
                break;

            case "house":
                userStates[userId].house = message;
                userStates[userId].step = "apartment";
                ctx.reply("🏠 Введите номер квартиры (если частный дом, напишите 'нет'):");  
                break;

            case "apartment":
                userStates[userId].apartment = message;
                userStates[userId].step = "time";
                ctx.reply(
                    "⏰ Введите удобное время вывоза мусора в формате ЧЧ:ММ (например, 18:00):\n\n" +
                    "⚠️ *Заявка вступает в силу через 30 минут после подачи!*", // <-- Оставляем предупреждение только для пользователя
                    { parse_mode: "Markdown" }
                );
                break;

            case "time":
                // Проверяем формат времени (ЧЧ:ММ)
                const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
                if (!timeRegex.test(message)) {
                    ctx.reply("❌ Некорректный формат! Введите время в формате ЧЧ:ММ (например, 18:00)");
                    return;
                }

                userStates[userId].time = message;
                // Формируем объект с данными заявки для хранения
                const requestData = {
                    street: userStates[userId].street,
                    house: userStates[userId].house,
                    apartment: userStates[userId].apartment,
                    time: userStates[userId].time
                };

                // Сообщение ДЛЯ ГРУППЫ (без строки про 30 минут!)
                const requestText = `📝 *Новая заявка*\n👤 Клиент: ${ctx.from.first_name} (@${ctx.from.username || "нет логина"})\n📍 Адрес:\n   • Улица: ${requestData.street}\n   • Дом: ${requestData.house}\n   • Квартира: ${requestData.apartment}\n⏰ Время: ${requestData.time}\n✅ Статус: Ожидает подтверждения`;

                // Сообщение пользователю (с предупреждением)
                ctx.reply(
                    "✅ Спасибо! Ваша заявка зарегистрирована и отправлена нашим сотрудникам. 🚛\n\n" +
                    "⚠️ *Заявка вступает в силу через 30 минут!*",
                    { parse_mode: "Markdown" }
                );

                // Отправляем заявку в группу и сохраняем message_id
                bot.telegram.sendMessage(chatId, requestText, { parse_mode: "Markdown" })
                    .then((sentMessage) => {
                        submittedRequests[userId] = {
                            ...requestData,
                            messageId: sentMessage.message_id
                        };
                    })
                    .catch((error) => {
                        console.error("Ошибка при отправке заявки в группу:", error);
                    });

                // Очищаем состояние пользователя
                delete userStates[userId];
                break;
        }
    }
});

// Запускаем бота
bot.launch();
console.log("Бот запущен...");
