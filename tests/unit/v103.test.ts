// V1.0.3 — entry card shows Chinese (and en/ko/vi) names for cities, airports and airlines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { airlineName, airportName, cityName } from '../../src/lib/cityNames';

test('city names in the card language, incl. compound "City (District)"', () => {
  assert.equal(cityName('Thượng Hải', 'zh'), '上海');
  assert.equal(cityName('thuong hai', 'zh'), '上海');
  assert.equal(cityName('Hàng Châu', 'ko'), '항저우');
  assert.equal(cityName('Thượng Hải (Lâm Cảng)', 'zh'), '上海（临港）');
  assert.equal(cityName('Incheon (Hàn Quốc)', 'zh'), '仁川（韩国）');
  assert.equal(cityName('Somewhere unknown', 'zh'), undefined);
});

test('airline from flight number prefix', () => {
  assert.equal(airlineName('MU5052', 'zh'), '中国东方航空');
  assert.equal(airlineName('mu 5033', 'en'), 'China Eastern Airlines');
  assert.equal(airlineName('ZZ123', 'zh'), undefined);
});

test('airport names tolerate codes, extra words and small typos', () => {
  assert.equal(airportName('Inchoen', 'zh'), '仁川国际机场');
  assert.equal(airportName('ICN', 'zh'), '仁川国际机场');
  assert.equal(airportName('Incheon International Airport', 'ko'), '인천국제공항');
  assert.equal(airportName('Pudong', 'zh'), '上海浦东国际机场');
  assert.equal(airportName('Sân bay Phố Đông', 'zh'), '上海浦东国际机场');
  assert.equal(airportName('Random field', 'zh'), undefined);
});
