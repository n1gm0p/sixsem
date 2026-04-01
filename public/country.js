function getCountryIdFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  const fromQuery = searchParams.get("id");
  if (fromQuery) {
    return fromQuery;
  }
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[1];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const AUTH_TOKEN_KEY = "tourism_auth_token";
const currentToken = localStorage.getItem(AUTH_TOKEN_KEY) || "";

function authHeaders() {
  return currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
}

async function checkFavorite(countryId) {
  if (!currentToken) {
    return false;
  }
  const response = await fetch("/api/favorites", { headers: authHeaders() });
  if (!response.ok) {
    return false;
  }
  const data = await response.json();
  return Array.isArray(data.favorites) && data.favorites.includes(Number(countryId));
}

async function toggleFavorite(countryId) {
  if (!currentToken) {
    alert("Сначала войдите в аккаунт на главной странице");
    return null;
  }
  const response = await fetch(`/api/favorites/${countryId}`, {
    method: "POST",
    headers: authHeaders()
  });
  const data = await response.json();
  if (!response.ok) {
    alert(data.message || "Ошибка избранного");
    return null;
  }
  return Boolean(data.isFavorite);
}

async function loadCountry() {
  const countryId = getCountryIdFromUrl();
  const hero = document.querySelector(".country-hero");
  const heroTitle = document.getElementById("hero-title");
  const description = document.getElementById("country-description");
  const places = document.getElementById("what-to-see");
  const tips = document.getElementById("tips-list");
  const favoriteButton = document.getElementById("country-favorite-btn");

  try {
    const response = await fetch(`/api/countries/${countryId}`);
    if (!response.ok) {
      throw new Error("Not found");
    }

    const country = await response.json();

    document.title = `${country.name} | On The Move`;
    heroTitle.textContent = country.heroTitle || country.name;
    description.textContent = country.description || "";
    hero.style.backgroundImage = "none";

    places.innerHTML = "";
    if (Array.isArray(country.whatToSee) && country.whatToSee.length > 0) {
      country.whatToSee.forEach((place) => {
        const card = document.createElement("article");
        card.className = "place-card";
        card.style.backgroundImage = place.image
          ? `linear-gradient(180deg, rgba(2, 6, 23, 0.1), rgba(2, 6, 23, 0.82)), url("${place.image}")`
          : "linear-gradient(135deg, #2f3b4d, #5f6f86)";

        card.innerHTML = `
          <div class="place-card-content">
            <h3>${escapeHtml(place.title || "")}</h3>
            <p>${escapeHtml(place.text || "")}</p>
          </div>
        `;
        places.appendChild(card);
      });
    } else {
      places.innerHTML = "<p>Достопримечательности скоро появятся.</p>";
    }

    tips.innerHTML = "";
    if (Array.isArray(country.tips) && country.tips.length > 0) {
      country.tips.forEach((tip) => {
        const li = document.createElement("li");
        li.textContent = tip;
        tips.appendChild(li);
      });
    } else {
      tips.innerHTML = "<li>Советы скоро появятся.</li>";
    }

    if (favoriteButton) {
      if (!currentToken) {
        favoriteButton.style.display = "none";
      } else {
        const initialFavorite = await checkFavorite(countryId);
        favoriteButton.textContent = initialFavorite ? "★ Избранное" : "☆ В избранное";
        favoriteButton.onclick = async () => {
          const nextState = await toggleFavorite(countryId);
          if (nextState === null) {
            return;
          }
          favoriteButton.textContent = nextState ? "★ Избранное" : "☆ В избранное";
        };
      }
    }
  } catch (error) {
    heroTitle.textContent = "Страна не найдена";
    description.textContent = "Проверьте ссылку или вернитесь на главную страницу.";
    places.innerHTML = "";
    tips.innerHTML = "<li><a href=\"/\" style=\"color:#93c5fd\">Перейти на главную</a></li>";
  }
}

loadCountry();
