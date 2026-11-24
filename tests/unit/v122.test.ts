// V1.2.2 — per-language title wrapping (presentation only; the text itself never changes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleSegments } from '../../src/ui/BalancedTitle';

test('zh titles break only between words and never leave one character alone', () => {
  for (const s of ['北京冬日记', '北京冬日旅行日记', '北京之旅', '示例城市圣诞日记', '记']) {
    const parts = titleSegments(s, 'zh');
    assert.equal(parts.join(''), s, 'text unchanged');
    if (parts.length > 1) for (const p of parts) assert.ok(p.length >= 2, `orphan in ${parts.join('|')}`);
  }
  assert.ok(titleSegments('北京冬日旅行日记', 'zh').length >= 2);
});

test('vi / en keep a short last word with the previous one (no orphan), text otherwise unchanged', () => {
  assert.equal(titleSegments('Nhật ký mùa đông Hà Nội', 'vi')[0], 'Nhật ký mùa đông Hà Nội');
  assert.equal(titleSegments('Winter Lights Demo', 'en')[0], 'Winter Lights\u00a0Demo');
  assert.equal(titleSegments('Shining Winter Lanterns', 'en')[0], 'Shining Winter Lanterns');
  assert.equal(titleSegments('Seoul', 'en')[0], 'Seoul');
});
