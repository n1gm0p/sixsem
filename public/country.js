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
let currentToken = localStorage.getItem(AUTH_TOKEN_KEY) || "";
let currentUser = null;

function authHeaders() {
  return currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
}

function updateAuthUi() {
  const authButton = document.getElementById("auth-btn");
  if (!authButton) {
    return;
  }
  if (currentUser) {
    authButton.setAttribute("aria-label", "Меню профиля");
    authButton.title = currentUser.displayName || "Профиль";
  } else {
    authButton.setAttribute("aria-label", "Войти");
    authButton.title = "Войти";
  }
}

async function fetchCurrentUser() {
  if (!currentToken) {
    currentUser = null;
    updateAuthUi();
    return;
  }
  try {
    const response = await fetch("/api/auth/me", { headers: authHeaders() });
    if (!response.ok) {
      throw new Error("unauthorized");
    }
    const data = await response.json();
    currentUser = data.user;
  } catch (error) {
    currentToken = "";
    currentUser = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  updateAuthUi();
}

async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST", headers: authHeaders() });
  } catch (error) {
    // ignore
  }
  currentToken = "";
  currentUser = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  updateAuthUi();
  window.location.href = "/";
}

function initAuthControls() {
  setupNavUserMenu({
    getIsLoggedIn: () => Boolean(currentUser),
    onGuestClick: () => {
      window.location.href = "/";
    },
    onLogout: () => {
      logout().catch(() => {
        window.location.href = "/";
      });
    }
  });
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

function setStarVisual(star, isFavorite) {
  star.classList.toggle("is-favorite", isFavorite);
  star.setAttribute("aria-pressed", isFavorite ? "true" : "false");
  star.setAttribute("aria-label", isFavorite ? "Убрать из избранного" : "Добавить в избранное");
  star.title = isFavorite ? "В избранном" : "В избранное";
}

async function setupFavoriteStar(countryId) {
  const star = document.getElementById("country-favorite-star");
  if (!star) {
    return;
  }

  star.style.display = "";

  const applyState = async () => {
    if (!currentToken) {
      setStarVisual(star, false);
      star.classList.add("country-fav-star--guest");
      return;
    }
    star.classList.remove("country-fav-star--guest");
    const fav = await checkFavorite(countryId);
    setStarVisual(star, fav);
  };

  await applyState();

  star.onclick = async () => {
    if (!currentToken) {
      alert("Сначала войдите в аккаунт на главной странице");
      return;
    }
    const nextState = await toggleFavorite(countryId);
    if (nextState === null) {
      return;
    }
    setStarVisual(star, nextState);
  };
}

async function loadCountry() {
  const countryId = getCountryIdFromUrl();
  const hero = document.querySelector(".country-hero");
  const heroTitle = document.getElementById("hero-title");
  const description = document.getElementById("country-description");
  const places = document.getElementById("what-to-see");
  const tips = document.getElementById("tips-list");
  const starBtn = document.getElementById("country-favorite-star");

  await fetchCurrentUser();

  try {
    const response = await fetch(`/api/countries/${countryId}`);
    if (!response.ok) {
      throw new Error("Not found");
    }

    const country = await response.json();

    document.title = `${country.name} | On The Move`;
    heroTitle.textContent = country.heroTitle || country.name;
    description.textContent = country.description || "";
    if (country.heroImage) {
      hero.style.backgroundImage = `linear-gradient(180deg, rgba(10, 16, 28, 0.52), rgba(10, 16, 28, 0.82)), url("${country.heroImage}")`;
      hero.style.backgroundSize = "cover";
      hero.style.backgroundPosition = "center";
    } else {
      hero.style.backgroundImage = "none";
    }

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

    await setupFavoriteStar(countryId);
  } catch (error) {
    heroTitle.textContent = "Страна не найдена";
    description.textContent = "Проверьте ссылку или вернитесь на главную страницу.";
    places.innerHTML = "";
    tips.innerHTML = "<li><a href=\"/\" style=\"color:#93c5fd\">Перейти на главную</a></li>";
    if (starBtn) {
      starBtn.style.display = "none";
    }
  }
}

initAuthControls();
loadCountry();
