const API_KEY = '2707187ca412c89bc4eff10634247619'; 
const BASE_URL = 'https://api.openweathermap.org/data/2.5/';

const bodyElement = document.body;
const locationNameElem = document.getElementById('location-name');
const dateElem = document.getElementById('date');
const lastUpdatedElem = document.getElementById('last-updated');
const weatherIconElem = document.getElementById('weather-icon');
const weatherDescElem = document.querySelector('.weather-desc');
const temperatureElem = document.getElementById('temperature');
const unitSpan = document.querySelector('.temperature-container .unit');
const feelsLikeElem = document.getElementById('feels-like');
const humidityElem = document.getElementById('humidity');
const windSpeedElem = document.getElementById('wind-speed');
const pressureElem = document.getElementById('pressure');
const visibilityElem = document.getElementById('visibility');
const uvIndexElem = document.getElementById('uv-index');
const sunriseElem = document.getElementById('sunrise');
const sunsetElem = document.getElementById('sunset');
const airQualityElem = document.getElementById('air-quality');
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const unitToggleBtn = document.getElementById('unit-toggle');
const themeToggleBtn = document.getElementById('theme-toggle');
const currentLocationBtn = document.getElementById('current-location-btn'); // NEW: Get reference to the new button
const hourlyForecastGrid = document.getElementById('hourly-forecast');
const dailyForecastGrid = document.getElementById('daily-forecast');
const errorMessage = document.getElementById('error-message');

let isCelsius = true;
let currentWeatherData = null;
let currentForecastData = null;

// --- Helper Functions ---
const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
};

const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatDay = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const options = { weekday: 'short' };
    return date.toLocaleDateString('en-US', options);
};

const getTemperature = (tempCelsius) => {
    return isCelsius ? Math.round(tempCelsius) : Math.round((tempCelsius * 9/5) + 32);
};

const getWindSpeed = (speedMps) => {
    return isCelsius ? `${(speedMps * 3.6).toFixed(1)} km/h` : `${(speedMps * 2.237).toFixed(1)} mph`; // Added toFixed(1) for consistent decimal places
};

const getUnitSymbol = () => {
    return isCelsius ? '°C' : '°F';
};

// --- Weather Data Fetching ---
async function getWeatherData(query) {
    errorMessage.style.display = 'none';
    clearForecasts();
    showSkeletonLoaders();

    let weatherUrl, forecastUrl;
    let unitsParam = 'metric'; // Always fetch in metric, then convert for display

    if (typeof query === 'object' && query.latitude && query.longitude) {
        weatherUrl = `${BASE_URL}weather?lat=${query.latitude}&lon=${query.longitude}&units=${unitsParam}&appid=${API_KEY}`;
        forecastUrl = `${BASE_URL}forecast?lat=${query.latitude}&lon=${query.longitude}&units=${unitsParam}&appid=${API_KEY}`;
    } else {
        weatherUrl = `${BASE_URL}weather?q=${query}&units=${unitsParam}&appid=${API_KEY}`;
        forecastUrl = `${BASE_URL}forecast?q=${query}&units=${unitsParam}&appid=${API_KEY}`;
    }

    try {
        const [weatherResponse, forecastResponse] = await Promise.all([
            fetch(weatherUrl),
            fetch(forecastUrl)
        ]);

        if (!weatherResponse.ok) {
            if (weatherResponse.status === 404) {
                throw new Error('City not found. Please check the spelling.');
            }
            throw new Error(`HTTP error! status: ${weatherResponse.status}`);
        }
        if (!forecastResponse.ok) {
            throw new Error(`HTTP error! status: ${forecastResponse.status} for forecast`);
        }

        currentWeatherData = await weatherResponse.json();
        currentForecastData = await forecastResponse.json();

        updateUI(currentWeatherData);
        updateHourlyForecast(currentForecastData);
        updateDailyForecast(currentForecastData);
        setWeatherBackground(currentWeatherData.weather[0].main);

        // Store last city only if it was a text search
        if (typeof query === 'string') {
            localStorage.setItem('lastCity', currentWeatherData.name);
        } else {
            // Clear last city if using current location to avoid stale city name on refresh
            localStorage.removeItem('lastCity');
        }


    } catch (error) {
        console.error('Error fetching weather data:', error);
        errorMessage.style.display = 'block';
        errorMessage.querySelector('p').textContent = error.message || 'Failed to fetch weather data. Please try again.';
        hideSkeletonLoaders();
        resetUIOnError();
    }
}

// --- UI Update Functions ---
function updateUI(data) {
    locationNameElem.textContent = data.name + ', ' + data.sys.country;
    dateElem.textContent = formatDate(data.dt);
    lastUpdatedElem.textContent = `Last updated: ${formatTime(data.dt)}`;
    weatherIconElem.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    weatherIconElem.alt = data.weather[0].description;
    weatherDescElem.textContent = data.weather[0].description;

    temperatureElem.textContent = getTemperature(data.main.temp);
    unitSpan.textContent = getUnitSymbol();
    feelsLikeElem.textContent = `${getTemperature(data.main.feels_like)}${getUnitSymbol()}`;
    humidityElem.textContent = `${data.main.humidity}%`;
    windSpeedElem.textContent = getWindSpeed(data.wind.speed);
    pressureElem.textContent = `${data.main.pressure} hPa`;
    visibilityElem.textContent = `${(data.visibility / 1000).toFixed(1)} km`; // Display with one decimal

    sunriseElem.textContent = formatTime(data.sys.sunrise + data.timezone);
    sunsetElem.textContent = formatTime(data.sys.sunset + data.timezone);

    uvIndexElem.textContent = '--'; // UV Index requires a separate API or a custom calculation
    airQualityElem.textContent = 'N/A'; // Air Quality requires a separate API

    hideSkeletonLoaders();
}

function updateHourlyForecast(forecastData) {
    hourlyForecastGrid.innerHTML = '';
    const now = new Date();

    const hourlyItems = forecastData.list.filter(item => {
        const itemDate = new Date(item.dt * 1000);
        // Only include forecasts up to 24 hours from now, starting from the next full hour or later
        return itemDate > now && (itemDate.getTime() - now.getTime()) / (1000 * 60 * 60) <= 24;
    }).slice(0, 8); // Get up to 8 hourly items

    hourlyItems.forEach(item => {
        const hourlyItemDiv = document.createElement('div');
        hourlyItemDiv.classList.add('hourly-item');
        hourlyItemDiv.innerHTML = `
            <div class="time">${formatTime(item.dt)}</div>
            <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="${item.weather[0].description}">
            <div class="temp">${getTemperature(item.main.temp)}${getUnitSymbol()}</div>
            <div class="chance-of-rain">${Math.round(item.pop * 100)}% Rain</div>
        `;
        hourlyForecastGrid.appendChild(hourlyItemDiv);
    });
}

function updateDailyForecast(forecastData) {
    dailyForecastGrid.innerHTML = '';
    const dailyData = {};

    forecastData.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toLocaleDateString('en-US'); // Group by date string

        // Skip current day if it's already passed
        const today = new Date().toLocaleDateString('en-US');
        if (dayKey === today && date.getHours() < new Date().getHours()) {
            return; // Skip if the forecast item is for the current day but an earlier hour
        }

        if (!dailyData[dayKey]) {
            dailyData[dayKey] = {
                minTemp: item.main.temp,
                maxTemp: item.main.temp,
                // Use the icon and description from the forecast around midday for best representation
                icon: item.weather[0].icon,
                description: item.weather[0].description,
                dt: item.dt
            };
        } else {
            dailyData[dayKey].minTemp = Math.min(dailyData[dayKey].minTemp, item.main.temp);
            dailyData[dayKey].maxTemp = Math.max(dailyData[dayKey].maxTemp, item.main.temp);
            // Optionally update icon/description if a "more significant" weather occurs later in the day
        }
    });

    const forecastDays = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b)).slice(0, 5); // Get up to 5 days, sorted

    forecastDays.forEach(dayKey => {
        const item = dailyData[dayKey];
        const dailyItemDiv = document.createElement('div');
        dailyItemDiv.classList.add('daily-item');
        dailyItemDiv.innerHTML = `
            <div class="day">${formatDay(item.dt)}</div>
            <img src="https://openweathermap.org/img/wn/${item.icon}.png" alt="${item.description}">
            <div class="temp-range">${getTemperature(item.maxTemp)}${getUnitSymbol()}/${getTemperature(item.minTemp)}${getUnitSymbol()}</div>
            <div class="desc">${item.description}</div>
        `;
        dailyForecastGrid.appendChild(dailyItemDiv);
    });
}


// --- Dynamic Backgrounds (CSS Class Management) ---
function setWeatherBackground(mainWeatherCondition) {
    bodyElement.classList.remove('weather-clear', 'weather-clouds', 'weather-rain', 'weather-drizzle', 'weather-snow', 'weather-thunderstorm', 'weather-mist', 'weather-fog', 'weather-haze', 'weather-smoke', 'weather-dust', 'weather-sand', 'weather-ash', 'weather-squall', 'weather-tornado');

    const condition = mainWeatherCondition.toLowerCase();

    if (condition.includes('clear')) {
        bodyElement.classList.add('weather-clear');
    } else if (condition.includes('cloud')) {
        bodyElement.classList.add('weather-clouds');
    } else if (condition.includes('rain') || condition.includes('drizzle')) {
        bodyElement.classList.add('weather-rain');
    } else if (condition.includes('snow')) {
        bodyElement.classList.add('weather-snow');
    } else if (condition.includes('thunderstorm')) {
        bodyElement.classList.add('weather-thunderstorm');
    } else if (condition.includes('mist') || condition.includes('fog') || condition.includes('haze') || condition.includes('smoke') || condition.includes('dust') || condition.includes('sand') || condition.includes('ash') || condition.includes('squall') || condition.includes('tornado')) {
        bodyElement.classList.add('weather-mist');
    } else {
        bodyElement.classList.add('weather-default'); // Fallback default
    }
}


// --- UI Management ---
function clearForecasts() {
    hourlyForecastGrid.innerHTML = '';
    dailyForecastGrid.innerHTML = '';
}

function showSkeletonLoaders() {
    clearForecasts();
    for (let i = 0; i < 5; i++) {
        const skeletonDiv = document.createElement('div');
        skeletonDiv.classList.add('hourly-item', 'skeleton');
        hourlyForecastGrid.appendChild(skeletonDiv);
    }
    for (let i = 0; i < 5; i++) {
        const skeletonDiv = document.createElement('div');
        skeletonDiv.classList.add('daily-item', 'skeleton');
        dailyForecastGrid.appendChild(skeletonDiv);
    }
    locationNameElem.textContent = 'Loading...';
    dateElem.textContent = '';
    lastUpdatedElem.textContent = '';
    weatherIconElem.src = '';
    weatherDescElem.textContent = '';
    temperatureElem.textContent = '--';
    feelsLikeElem.textContent = `--${getUnitSymbol()}`;
    humidityElem.textContent = '--%';
    windSpeedElem.textContent = `-- ${isCelsius ? 'km/h' : 'mph'}`;
    pressureElem.textContent = '-- hPa';
    visibilityElem.textContent = '-- km';
    uvIndexElem.textContent = '--';
    sunriseElem.textContent = '--:--';
    sunsetElem.textContent = '--:--';
    airQualityElem.textContent = 'N/A';
}

function hideSkeletonLoaders() {
    const skeletons = document.querySelectorAll('.skeleton');
    skeletons.forEach(skeleton => skeleton.remove());
}

function resetUIOnError() {
    locationNameElem.textContent = 'Location Unknown';
    dateElem.textContent = '';
    lastUpdatedElem.textContent = '';
    weatherIconElem.src = 'https://openweathermap.org/img/wn/01d@2x.png';
    weatherDescElem.textContent = 'N/A';
    temperatureElem.textContent = '--';
    unitSpan.textContent = getUnitSymbol();
    feelsLikeElem.textContent = `--${getUnitSymbol()}`;
    humidityElem.textContent = '--%';
    windSpeedElem.textContent = `-- ${isCelsius ? 'km/h' : 'mph'}`;
    pressureElem.textContent = '-- hPa';
    visibilityElem.textContent = '-- km';
    uvIndexElem.textContent = '--';
    sunriseElem.textContent = '--:--';
    sunsetElem.textContent = '--:--';
    airQualityElem.textContent = 'N/A';
    clearForecasts();
    // Keep the current weather background based on last successful fetch, or default if none
    if (!currentWeatherData) {
        bodyElement.classList.add('weather-default');
    }
}

// --- Theme Toggle Logic ---
function toggleTheme() {
    const currentTheme = bodyElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    bodyElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('themePreference', newTheme);
    updateThemeToggleButton(newTheme);
}

function updateThemeToggleButton(theme) {
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        themeToggleBtn.classList.remove('dark-mode-icon');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        themeToggleBtn.classList.add('dark-mode-icon');
    }
}


// --- Event Listeners ---
searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) {
        getWeatherData(city);
    } else {
        errorMessage.style.display = 'block';
        errorMessage.querySelector('p').textContent = 'Please enter a city name.';
    }
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

unitToggleBtn.addEventListener('click', () => {
    isCelsius = !isCelsius;
    unitToggleBtn.textContent = isCelsius ? '°F' : '°C';
    localStorage.setItem('unitPreference', isCelsius ? 'celsius' : 'fahrenheit');

    if (currentWeatherData) {
        updateUI(currentWeatherData);
        updateHourlyForecast(currentForecastData);
        updateDailyForecast(currentForecastData);
    }
});

themeToggleBtn.addEventListener('click', toggleTheme);

// NEW: Event listener for the current location button
currentLocationBtn.addEventListener('click', () => {
    getUserLocation();
});


// --- Initial Load & PWA Registration ---
document.addEventListener('DOMContentLoaded', () => {
    // Load theme preference
    const savedTheme = localStorage.getItem('themePreference');
    if (savedTheme) {
        bodyElement.setAttribute('data-theme', savedTheme);
        updateThemeToggleButton(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        bodyElement.setAttribute('data-theme', 'dark');
        updateThemeToggleButton('dark');
    } else {
        bodyElement.setAttribute('data-theme', 'light');
        updateThemeToggleButton('light');
    }

    // Load unit preference
    const savedUnit = localStorage.getItem('unitPreference');
    if (savedUnit === 'fahrenheit') {
        isCelsius = false;
        unitToggleBtn.textContent = '°C';
    } else {
        isCelsius = true;
        unitToggleBtn.textContent = '°F';
    }

    const lastCity = localStorage.getItem('lastCity');
    if (lastCity) {
        cityInput.value = lastCity;
        getWeatherData(lastCity);
    } else {
        getUserLocation(); // Call on initial load if no city saved
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/weather_app_advanced/service-worker.js')
            .then(reg => console.log('Service Worker Registered', reg))
            .catch(err => console.error('Service Worker Registration Failed:', err));
    }
});

// Function to get user's current location (existing, but now explicitly called by button)
function getUserLocation() {
    if (navigator.geolocation) {
        showSkeletonLoaders();
        locationNameElem.textContent = 'Getting your location...'; // Provide immediate feedback
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                getWeatherData({ latitude, longitude });
                // Clear city input when location is fetched via geolocation
                cityInput.value = '';
            },
            error => {
                console.warn('Error getting user location:', error);
                errorMessage.style.display = 'block';
                // More user-friendly error message based on error code
                let userFriendlyError = 'Could not get your location. Please enable location services in your browser settings.';
                if (error.code === error.PERMISSION_DENIED) {
                    userFriendlyError = 'Location access denied. Please allow location access in your browser settings to use this feature.';
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    userFriendlyError = 'Location information is unavailable. Please try again later.';
                } else if (error.code === error.TIMEOUT) {
                    userFriendlyError = 'The request to get user location timed out. Please check your internet connection.';
                }
                errorMessage.querySelector('p').textContent = userFriendlyError;
                hideSkeletonLoaders();
                resetUIOnError();
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        errorMessage.style.display = 'block';
        errorMessage.querySelector('p').textContent = 'Geolocation is not supported by your browser. Please search for a city manually.';
        hideSkeletonLoaders();
        resetUIOnError();
    }
}