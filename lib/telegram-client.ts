export type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
};
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
export async function telegramWebApp(): Promise<TelegramWebApp | null> {
  let restored = false;
  try {
    restored = sessionStorage.getItem("abl:telegram") === "true";
  } catch {}
  const launched =
    restored ||
    /(?:^|[&#?])tgWebApp(?:Data|Platform)=/.test(
      window.location.hash + window.location.search,
    );
  if (!launched && !window.Telegram?.WebApp?.initData) return null;
  if (!window.Telegram?.WebApp) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-web-app.js";
      script.async = true;
      const timeout = setTimeout(() => {
        script.remove();
        reject(
          Error(
            "Не удалось загрузить Telegram. Проверьте соединение и откройте приложение снова.",
          ),
        );
      }, 10000);
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(Error("Не удалось загрузить Telegram. Проверьте соединение."));
      };
      document.head.appendChild(script);
    });
  }
  const app = window.Telegram?.WebApp;
  if (!app) throw Error("Откройте приложение кнопкой в Telegram-боте");
  try {
    sessionStorage.setItem("abl:telegram", "true");
  } catch {}
  app.ready();
  app.expand();
  if (app.isVersionAtLeast?.("6.1")) {
    app.setHeaderColor?.("#f5f4f0");
    app.setBackgroundColor?.("#f5f4f0");
  }
  return app;
}
