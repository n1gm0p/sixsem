const AUTH_TOKEN_KEY = "tourism_auth_token";
const token = localStorage.getItem(AUTH_TOKEN_KEY) || "";

function authHeaders() {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setCardBackground(card, country) {
  if (country.heroImage) {
    card.style.backgroundImage = `linear-gradient(180deg, rgba(15, 23, 42, 0.2), rgba(2, 6, 23, 0.82)), url("${country.heroImage}")`;
    card.style.backgroundSize = "cover";
    card.style.backgroundPosition = "center";
  } else {
    card.style.background = country.cardGradient;
  }
}

async function loadProfile() {
  const profileUser = document.getElementById("profile-user");
  const container = document.getElementById("favorites-content");

  if (!token) {
    profileUser.textContent = "Требуется авторизация";
    container.innerHTML = "<p>Войдите на главной странице, чтобы увидеть избранное.</p>";
    return;
  }

  const meResponse = await fetch("/api/auth/me", { headers: authHeaders() });
  if (!meResponse.ok) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    profileUser.textContent = "Сессия истекла";
    container.innerHTML = "<p>Снова войдите на главной странице.</p>";
    return;
  }
  const meData = await meResponse.json();
  profileUser.textContent = meData.user.displayName;

  const [favoritesResponse, countriesResponse] = await Promise.all([
    fetch("/api/favorites", { headers: authHeaders() }),
    fetch("/api/countries")
  ]);

  if (!favoritesResponse.ok || !countriesResponse.ok) {
    container.innerHTML = "<p>Не удалось загрузить избранное.</p>";
    return;
  }

  const favoritesData = await favoritesResponse.json();
  const countries = await countriesResponse.json();
  const favoriteIds = new Set(favoritesData.favorites || []);
  const favorites = countries.filter((country) => favoriteIds.has(country.id));

  if (favorites.length === 0) {
    container.innerHTML = "<p>Пока пусто. Добавьте страны в избранное на главной странице.</p>";
    return;
  }

  container.innerHTML = "";
  favorites.forEach((country) => {
    const card = document.createElement("article");
    card.className = "country-card";
    setCardBackground(card, country);
    card.innerHTML = `
      <h3>${country.name}</h3>
      <p>${country.subtitle}</p>
      <div class="card-actions">
        <a class="card-link" href="/country.html?id=${country.id}">Читать гид</a>
      </div>
    `;
    container.appendChild(card);
  });
}

loadProfile().catch(() => {
  const container = document.getElementById("favorites-content");
  if (container) {
    container.innerHTML = "<p>Ошибка загрузки профиля.</p>";
  }
});
