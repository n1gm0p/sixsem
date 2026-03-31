async function loadCountries() {
  const grid = document.getElementById("countries-grid");

  try {
    const response = await fetch("/api/countries");
    if (!response.ok) {
      throw new Error("Fetch failed");
    }

    const countries = await response.json();
    grid.innerHTML = "";

    countries.forEach((country) => {
      const card = document.createElement("article");
      card.className = "country-card";
      if (country.heroImage) {
        card.style.backgroundImage = `linear-gradient(180deg, rgba(15, 23, 42, 0.2), rgba(2, 6, 23, 0.82)), url("${country.heroImage}")`;
        card.style.backgroundSize = "cover";
        card.style.backgroundPosition = "center";
      } else {
        card.style.background = country.cardGradient;
      }

      card.innerHTML = `
        <h3>${country.name}</h3>
        <p>${country.subtitle}</p>
        <a class="card-link" href="/country.html?id=${country.id}">Читать гид</a>
      `;

      grid.appendChild(card);
    });
  } catch (error) {
    grid.innerHTML = "<p>Не удалось загрузить страны. Попробуйте позже.</p>";
  }
}

loadCountries();
