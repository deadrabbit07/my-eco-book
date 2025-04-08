let latitude = 33.450701;
let longitude = 126.570667;
let map;
const KAKAO_REST_API_KEY = "c937fb927f2ee984c523bbdde1540495";
const KAKAO_MAP_URL = "https://apis-navi.kakaomobility.com/v1/directions";
const BIKE_MAP_URL =
  "http://openapi.seoul.go.kr:8088/484c634d63796f75373754726c6b6b/json/bikeList/1/1000";
const KAKAO_ADDRESS_URL =
  "https://dapi.kakao.com/v2/local/geo/coord2address.json";
const PRECIPITATION_URL =
  "https://openapi.seoul.go.kr:8088/484c634d63796f75373754726c6b6b/json/ListRainfallService/1/5/";
const BIKE_IMAGE_SRC = "./assets/marker.png";
let startPoint = null;
let endPoint = null;
let distance = 0;
const infoContent = document.querySelector(".info-content");
const carbon = infoContent.querySelector(".carbon");
const address = infoContent.querySelector(".address");
const rainfall = infoContent.querySelector(".rainfall");

// 연료별 탄소 배출 계수 (단위: kg CO₂/L)
const emissionFactors = {
  gasoline: 2.31, // 휘발유
  diesel: 2.68, // 경유
  electric: 0, // 전기차
};

const fuelEfficiency = 15; // km/L (연비)
const fuelType = "gasoline"; // 연료 타입

/**
 * 탄소 배출량 계산 함수
 * @param {number} distance - 주행 거리(m)
 * @param {number} fuelEfficiency - 차량 연비(km/L)
 * @param {string} fuelType - 연료 타입 ("gasoline", "diesel", "electric")
 * @returns {number} - 탄소 배출량 (kg CO₂)
 */

function initializeMap(lat, lng) {
  const mapContainer = document.getElementById("map");
  const mapOptions = {
    center: new kakao.maps.LatLng(lat, lng),
    level: 3,
  };
  map = new kakao.maps.Map(mapContainer, mapOptions); // 전역 변수 map 초기화
}

function calculateCarbonEmissions(distance, fuelEfficiency, fuelType) {
  // distance를 m 단위에서 km 단위로 변환
  // *km가 아니라 m 단위로 바꿈
  // const distanceInKm = distance / 1000;

  // 연료별 탄소 배출 계수 가져오기
  const emissionFactor = emissionFactors[fuelType];

  // 전기차는 배출량이 0이므로 계산을 하지 않음
  if (emissionFactor === 0) {
    return 0;
  }

  // 필요한 연료량(L) 계산
  const fuelConsumed = distance / fuelEfficiency;

  // 탄소 배출량 계산
  const carbonEmissions = fuelConsumed * emissionFactor;

  return carbonEmissions;
}

const updateInfo = () => {
  carbon.querySelector(".distance_value").innerText = `약 ${Math.round(
    distance
  )}m`;
  carbon.querySelector(".carbon_value").innerText = `${calculateCarbonEmissions(
    distance,
    fuelEfficiency,
    fuelType
  ).toFixed(2)} kg CO₂`;
};

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
  const data = await response.json();
  return data;
};

let polyline = null; // Polyline을 전역 변수로 선언

const getDirections = async (map) => {
  const url = `${KAKAO_MAP_URL}?origin=${startPoint.getLng()},${startPoint.getLat()}&destination=${endPoint.getLng()},${endPoint.getLat()}&appkey=${KAKAO_REST_API_KEY}`;
  const headers = {
    Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, { headers });
  const data = await response.json();
  distance += data.routes[0].summary.distance;
  const linePath = [];
  data.routes[0].sections[0].roads.forEach((router) => {
    router.vertexes.forEach((vertex, index) => {
      if (index % 2 === 0) {
        linePath.push(
          new kakao.maps.LatLng(
            router.vertexes[index + 1],
            router.vertexes[index]
          )
        );
      }
    });
  });

  // 이전에 생성된 Polyline이 있으면 지도에서 제거
  if (polyline) {
    polyline.setMap(null);
  }

  // 새로운 Polyline 생성 및 설정
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

const currentLocation = window.navigator.geolocation;
currentLocation.getCurrentPosition(async (position) => {
  latitude = position.coords.latitude;
  longitude = position.coords.longitude;

  const addressData = await getAddress(latitude, longitude);
  address.querySelector(
    "#address_value"
  ).innerText = `${addressData.documents[0].address.region_1depth_name} ${addressData.documents[0].address.region_2depth_name} ${addressData.documents[0].address.region_3depth_name}`;

  const precipitationData = await getPrecipitation(
    addressData.documents[0].address.region_2depth_name
  );
  rainfall.querySelector(
    "#rainfall_value"
  ).innerText = `${precipitationData.row[0].RAINFALL10}mm / 10분`;

  const mapContainer = document.getElementById("map");
  const mapOptions = {
    center: new kakao.maps.LatLng(latitude, longitude),
    level: 3,
  };

  let map = new kakao.maps.Map(mapContainer, mapOptions);

  getBikeInfo().then((bikeInfo) => {
    const bikeList = bikeInfo.row;

    bikeList.forEach((bike) => {
      const bikePosition = new kakao.maps.LatLng(
        bike.stationLatitude,
        bike.stationLongitude
      );

      const imageSize = new kakao.maps.Size(30, 30);
      const imageOption = {
        offset: new kakao.maps.Point(0, 0),
      };
      const markerImage = new kakao.maps.MarkerImage(
        BIKE_IMAGE_SRC,
        imageSize,
        imageOption
      );

      const bikeMarker = new kakao.maps.Marker({
        position: bikePosition,
        image: markerImage,
      });

      bikeMarker.setMap(map);

      const bikeContent = `<div class="bike-info">
                    <h4>${bike.stationName}</h4>
                    <p>${bike.parkingBikeTotCnt}대 자전거 보유</p>
                </div>`;
      const bikeInfoWindow = new kakao.maps.InfoWindow({
        content: bikeContent,
        removable: true,
      });

      kakao.maps.event.addListener(bikeMarker, "click", () => {
        bikeInfoWindow.open(map, bikeMarker);
      });
    });
  });

  let markers = []; // 마커를 저장할 배열 생성

  // 마커를 추가할 때 배열에 저장하고 조건에 따라 제거 및 초기화하는 함수
  const addMarker = (position, map) => {
    const marker = new kakao.maps.Marker({
      position: position,
      map: map,
    });
    marker.setMap(map);
    markers.push(marker); // 배열에 마커 저장

    // 마커가 2개 초과로 생성될 경우, 첫 번째와 마지막 마커를 제외하고 모두 제거
    if (markers.length > 2) {
      // 중간 마커들을 제거 (첫 번째와 마지막 마커는 제외)
      for (let i = 1; i < markers.length - 1; i++) {
        markers[i].setMap(null);
      }

      // 첫 번째와 마지막 마커만 남기고 배열 갱신
      markers = [markers[0], markers[markers.length - 1]];

      // 거리 및 시작/종료 지점 초기화
      distance = 0;
      startPoint = markers[0].getPosition();
      endPoint = markers[1].getPosition();

      updateInfo(); // 초기화된 정보 업데이트
    }
  };

  // 지도 클릭 이벤트에서 마커 생성 시 사용
  kakao.maps.event.addListener(map, "click", function (mouseEvent) {
    const latlng = mouseEvent.latLng;

    if (startPoint === null) {
      startPoint = latlng;
    } else {
      endPoint = latlng;
    }

    addMarker(latlng, map); // 마커 추가 및 관리

    if (endPoint !== null) {
      getDirections(map); // 경로 및 거리 계산
    }
  });

  // 초기화 버튼 클릭 이벤트 추가
  document
    .querySelector(".info-resetBtn > button")
    .addEventListener("click", () => {
      // 모든 마커 제거
      markers.forEach((marker) => marker.setMap(null));
      markers = []; // 마커 배열 초기화

      // Polyline 제거
      if (polyline) {
        polyline.setMap(null);
        polyline = null;
      }

      // 거리 및 탄소 배출량 초기화
      distance = 0;
      startPoint = null;
      endPoint = null;
      updateInfo(); // 초기화된 정보 업데이트
    });
});
