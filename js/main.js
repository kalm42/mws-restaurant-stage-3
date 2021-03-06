import "@babel/polyfill";
import DBHelper from "./dbhelper";

// Next two lines take from ->
// https://github.com/thebigtoona/mws-restaurant-stage-1/blob/master/app/scripts/main.js
window["map"];
window["markers"] = [];

/**
 * Lazy loading of restaurant images
 * concept from https://www.smashingmagazine.com/2018/01/deferring-lazy-loading-intersection-observer-api/
 */
const lazyload = image => {
  const src = image.getAttribute("data-src");
  if (!src) {
    return;
  }
  image.src = src;
};
const io = new IntersectionObserver(entries => {
  entries.map(entry => {
    if (entry.isIntersecting) {
      // handle loading of element.
      lazyload(entry.target);
      // Stop tracking element.
      io.unobserve(entry.target);
    }
  });
});

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener("DOMContentLoaded", event => {
  fetchNeighborhoods();
  fetchCuisines();
  DBHelper.processPending();
  DBHelper.getPending().then(pending => {
    if (pending.length > 0) {
      const main = document.getElementById("maincontent");
      // make pending notification.
      const notification = document.createElement("section");
      notification.setAttribute("class", "pending");

      const message = document.createElement("p");
      message.innerHTML = `Offline: ${pending.length} pending requests.`;

      notification.appendChild(message);

      main.appendChild(notification);
    }
  });
});

/**
 * Fetch all neighborhoods and set their HTML.
 */
const fetchNeighborhoods = () => {
  // 1. Check for local indexedDb
  // 2. On fail fetch remote data

  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) {
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
};

/**
 * Set neighborhoods HTML.
 */
const fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById("neighborhoods-select");
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement("option");
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
};

/**
 * Fetch all cuisines and set their HTML.
 */
const fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
};

/**
 * Set cuisines HTML.
 */
const fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById("cuisines-select");

  cuisines.forEach(cuisine => {
    const option = document.createElement("option");
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
};

window.initMap = () => {
  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: loc,
    scrollwheel: false,
    disableDefaultUI: true
  });
  updateRestaurants();
};

/**
 * Toggle fix-map class on map-container
 */
const mapContainer = document.getElementById("map-container");
window.addEventListener("scroll", function(event) {
  if (window.innerWidth > 700 && window.scrollY > 80) {
    mapContainer.classList.add("fix-map");
  } else {
    mapContainer.classList.remove("fix-map");
  }
});

/**
 * Update page and map for current restaurants.
 */
const updateRestaurants = () => {
  // Correct the header height.
  const navs = document.getElementsByTagName("nav");
  const nav = navs[0];
  nav.style.height = "80px";

  const cSelect = document.getElementById("cuisines-select");
  const nSelect = document.getElementById("neighborhoods-select");

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  if (!DBHelper) {
    return;
  }

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(
    cuisine,
    neighborhood,
    (error, restaurants) => {
      if (error) {
        // Got an error!
        throw new Error(error);
      } else {
        resetRestaurants(restaurants);
        fillRestaurantsHTML();
      }
    }
  );
};

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
const resetRestaurants = restaurants => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById("restaurants-list");
  ul.innerHTML = "";

  // Remove all map markers
  if (self.markers) {
    self.markers.forEach(marker => marker.remove());
  }
  self.markers = [];
  self.restaurants = restaurants;
};

/**
 * Create all restaurants HTML and add them to the webpage.
 */
const fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementById("restaurants-list");
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
};

/**
 * Create restaurant HTML.
 */
const createRestaurantHTML = restaurant => {
  if (!DBHelper) {
    return;
  }
  const li = document.createElement("li");

  const image = document.createElement("img");
  image.className = "restaurant-img";
  image.alt = `A photo of ${restaurant.name}`;
  image.setAttribute("data-src", DBHelper.imageUrlForRestaurant(restaurant));
  io.observe(image);
  li.append(image);

  const name = document.createElement("h1");
  name.innerHTML = restaurant.name;
  li.append(name);

  const neighborhood = document.createElement("p");
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement("p");
  address.innerHTML = restaurant.address;
  li.append(address);

  const more = document.createElement("a");
  more.innerHTML = "View Details";
  more.href = DBHelper.urlForRestaurant(restaurant);
  li.append(more);

  return li;
};

/**
 * Add markers for current restaurants to the map.
 */
const addMarkersToMap = (restaurants = self.restaurants) => {
  if (!DBHelper) {
    return;
  }
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, "click", () => {
      window.location.href = marker.url;
    });
    self.markers.push(marker);
  });
};
