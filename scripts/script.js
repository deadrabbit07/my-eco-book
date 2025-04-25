let latitude = 33.450701;
let longitude = 126.570667;

const KAKAO_REST_API_KEY = "c937fb927f2ee984c523bbdde1540495";
const KAKAO_MAP_URL = "https://apis-navi.kakaomobility.com/v1/directions";
const BIKE_MAP_URL =
  "http://openapi.seoul.go.kr:8088/484c634d63796f75373754726c6b6b/json/bikeList/1/1000";
const KAKAO_ADDRESS_URL =
  "https://dapi.kakao.com/v2/local/geo/coord2address.json";
const PRECIPITATION_URL = "http://localhost:3000/rainfall?region=";
const BIKE_IMAGE_SRC = "./assets/marker.png";

let startPoint = null;
let endPoint = null;
let distance = 0;
let polyline = null;
let map = null;

const infoContent = document.querySelector(".info-content");
const carbon = infoContent.querySelector(".carbon");
const address = infoContent.querySelector(".address");
const rainfall = infoContent.querySelector(".rainfall");

const emissionFactors = {
  gasoline: 2.31,
  diesel: 2.68,
  electric: 0,
};
(async () => {
  const response = await fetch(PRECIPITATION_URL + address);
})();

const fuelEfficiency = 15;
const fuelType = "gasoline";

// 탄소 계산 (정확하게 km 변환 후 계산)
function calculateCarbonEmissions(distance, fuelEfficiency, fuelType) {
  const distanceInKm = distance / 1000;
  const emissionFactor = emissionFactors[fuelType];
  if (emissionFactor === 0) return 0;
  const fuelConsumed = distanceInKm / fuelEfficiency;
  return fuelConsumed * emissionFactor;
}

function updateInfo() {
  carbon.querySelector(".distance_value").innerText = `약 ${(
    distance / 1000
  ).toFixed(2)}km`;
  carbon.querySelector(".carbon_value").innerText = `${calculateCarbonEmissions(
    distance,
    fuelEfficiency,
    fuelType
  ).toFixed(2)} kg CO₂`;
}

const getBikeInfo = async () => {
  const response = await fetch(BIKE_MAP_URL);
  const { rentBikeStatus } = await response.json();
  return rentBikeStatus;
};

const getPrecipitation = async (address) => {
  const response = await fetch(PRECIPITATION_URL + address);
  const { ListRainfallService } = await response.json();
  return ListRainfallService;
};

const getAddress = async (lat, lng) => {
  const url = `${KAKAO_ADDRESS_URL}?x=${lng}&y=${lat}&input_coord=WGS84`;
  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });
  return await response.json();
};

const getDirections = async () => {
  const url = `${KAKAO_MAP_URL}?origin=${startPoint.getLng()},${startPoint.getLat()}&destination=${endPoint.getLng()},${endPoint.getLat()}&appkey=${KAKAO_REST_API_KEY}`;
  const headers = {
    Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, { headers });
  const data = await response.json();

  distance = data.routes[0].summary.distance;

  const linePath = [];
  data.routes[0].sections[0].roads.forEach((road) => {
    road.vertexes.forEach((vertex, i) => {
      if (i % 2 === 0) {
        linePath.push(
          new kakao.maps.LatLng(road.vertexes[i + 1], road.vertexes[i])
        );
      }
    });
  });

  if (polyline) {
    polyline.setMap(null);
  }

  polyline = new kakao.maps.Polyline({
    path: linePath,
    strokeWeight: 5,
    strokeColor: "#000000",
    strokeOpacity: 0.7,
    strokeStyle: "solid",
  });
  polyline.setMap(map);

  updateInfo();
};

// 현재 위치 기반 지도 초기화
navigator.geolocation.getCurrentPosition(async (position) => {
  latitude = position.coords.latitude;
  longitude = position.coords.longitude;

  const addressData = await getAddress(latitude, longitude);
  const region = addressData.documents[0].address;
  address.querySelector(
    "#address_value"
  ).innerText = `${region.region_1depth_name} ${region.region_2depth_name} ${region.region_3depth_name}`;

  const rainData = await getPrecipitation(region.region_2depth_name);
  rainfall.querySelector(
    "#rainfall_value"
  ).innerText = `${rainData.row[0].RAINFALL10}mm / 10분`;

  const mapContainer = document.getElementById("map");
  const mapOptions = {
    center: new kakao.maps.LatLng(latitude, longitude),
    level: 3,
  };
  map = new kakao.maps.Map(mapContainer, mapOptions);

  // 따릉이 마커 표시
  const bikeInfo = await getBikeInfo();
  bikeInfo.row.forEach((bike) => {
    const position = new kakao.maps.LatLng(
      bike.stationLatitude,
      bike.stationLongitude
    );
    const markerImage = new kakao.maps.MarkerImage(
      BIKE_IMAGE_SRC,
      new kakao.maps.Size(30, 30),
      { offset: new kakao.maps.Point(0, 0) }
    );
    const marker = new kakao.maps.Marker({ position, image: markerImage });
    marker.setMap(map);

    const content = `<div class="bike-info"><h4>${bike.stationName}</h4><p>${bike.parkingBikeTotCnt}대 자전거 보유</p></div>`;
    const infoWindow = new kakao.maps.InfoWindow({ content, removable: true });

    kakao.maps.event.addListener(marker, "click", () => {
      infoWindow.open(map, marker);
    });
  });

  let markers = [];

  // 지도 클릭 시 마커 추가 및 경로 계산
  kakao.maps.event.addListener(map, "click", (mouseEvent) => {
    const latlng = mouseEvent.latLng;

    if (startPoint === null) {
      startPoint = latlng;
    } else {
      endPoint = latlng;
    }

    const marker = new kakao.maps.Marker({ position: latlng });
    marker.setMap(map);
    markers.push(marker);

    if (markers.length > 2) {
      for (let i = 1; i < markers.length - 1; i++) {
        markers[i].setMap(null);
      }
      markers = [markers[0], markers[markers.length - 1]];
      startPoint = markers[0].getPosition();
      endPoint = markers[1].getPosition();
    }

    if (startPoint && endPoint) {
      getDirections();
    }
  });

  // 초기화 버튼
  document
    .querySelector(".info-resetBtn > button")
    .addEventListener("click", () => {
      markers.forEach((m) => m.setMap(null));
      markers = [];
      startPoint = null;
      endPoint = null;
      distance = 0;
      if (polyline) {
        polyline.setMap(null);
        polyline = null;
      }
      updateInfo();
    });
});
