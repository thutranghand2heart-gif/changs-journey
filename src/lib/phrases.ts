export interface Phrase { zh: string; py: string; vi: string; en: string; ko?: string; group: string }

/** Meaning shown under a phrase, in the interface language. In the Chinese interface the phrase itself is the
 * meaning, so no second language is mixed in. */
export const meaningOf = (p: Phrase, lang: string) => (lang === 'zh' ? '' : lang === 'en' ? p.en : lang === 'ko' ? p.ko ?? p.en : p.vi);

export const PHRASES: Phrase[] = [
  { group: 'Chào hỏi', zh: '你好', py: 'Nǐ hǎo', vi: 'Xin chào', en: 'Hello', ko: '안녕하세요' },
  { group: 'Chào hỏi', zh: '谢谢', py: 'Xièxie', vi: 'Cảm ơn', en: 'Thank you', ko: '감사합니다' },
  { group: 'Chào hỏi', zh: '不好意思', py: 'Bù hǎoyìsi', vi: 'Xin lỗi / làm phiền', en: 'Excuse me / sorry', ko: '실례합니다 / 죄송합니다' },
  { group: 'Chào hỏi', zh: '圣诞快乐！', py: 'Shèngdàn kuàilè!', vi: 'Giáng sinh vui vẻ!', en: 'Merry Christmas!', ko: '메리 크리스마스!' },
  { group: 'Chào hỏi', zh: '我不会说中文。', py: 'Wǒ bú huì shuō Zhōngwén.', vi: 'Tôi không biết nói tiếng Trung.', en: "I don't speak Chinese.", ko: '저는 중국어를 못해요.' },
  { group: 'Chào hỏi', zh: '我是越南人。', py: 'Wǒ shì Yuènán rén.', vi: 'Tôi là người Việt Nam.', en: "I'm Vietnamese.", ko: '저는 베트남 사람이에요.' },
  { group: 'Di chuyển', zh: '请带我去这个地址。', py: 'Qǐng dài wǒ qù zhège dìzhǐ.', vi: 'Làm ơn đưa tôi đến địa chỉ này.', en: 'Please take me to this address.', ko: '이 주소로 데려다 주세요.' },
  { group: 'Di chuyển', zh: '地铁站在哪里？', py: 'Dìtiězhàn zài nǎlǐ?', vi: 'Ga tàu điện ngầm ở đâu?', en: 'Where is the metro station?', ko: '지하철역이 어디예요?' },
  { group: 'Di chuyển', zh: '去机场。', py: 'Qù jīchǎng.', vi: 'Đi sân bay.', en: 'To the airport.', ko: '공항으로 가 주세요.' },
  { group: 'Di chuyển', zh: '这趟车去这里吗？', py: 'Zhè tàng chē qù zhèlǐ ma?', vi: 'Chuyến này có đi tới đây không?', en: 'Does this train go here?', ko: '이 열차가 여기로 가나요?' },
  { group: 'Di chuyển', zh: '请在这里停车。', py: 'Qǐng zài zhèlǐ tíngchē.', vi: 'Làm ơn dừng xe ở đây.', en: 'Please stop here.', ko: '여기서 세워 주세요.' },
  { group: 'Ăn uống', zh: '我要这个。', py: 'Wǒ yào zhège.', vi: 'Tôi muốn món này.', en: "I'd like this one.", ko: '이걸로 할게요.' },
  { group: 'Ăn uống', zh: '不要辣。', py: 'Bú yào là.', vi: 'Không cay.', en: 'Not spicy.', ko: '맵지 않게 해 주세요.' },
  { group: 'Ăn uống', zh: '有素食吗？', py: 'Yǒu sùshí ma?', vi: 'Có món chay không?', en: 'Do you have vegetarian food?', ko: '채식 메뉴 있어요?' },
  { group: 'Ăn uống', zh: '买单。', py: 'Mǎidān.', vi: 'Tính tiền.', en: 'The bill, please.', ko: '계산해 주세요.' },
  { group: 'Ăn uống', zh: '一杯热茶，谢谢。', py: 'Yì bēi rè chá, xièxie.', vi: 'Một tách trà nóng, cảm ơn.', en: 'A cup of hot tea, please.', ko: '따뜻한 차 한 잔 주세요.' },
  { group: 'Mua sắm', zh: '多少钱？', py: 'Duōshao qián?', vi: 'Bao nhiêu tiền?', en: 'How much is it?', ko: '얼마예요?' },
  { group: 'Mua sắm', zh: '可以用支付宝吗？', py: 'Kěyǐ yòng Zhīfùbǎo ma?', vi: 'Có thể trả bằng Alipay không?', en: 'Can I pay with Alipay?', ko: '알리페이로 결제할 수 있어요?' },
  { group: 'Mua sắm', zh: '可以刷卡吗？', py: 'Kěyǐ shuākǎ ma?', vi: 'Có thể quẹt thẻ không?', en: 'Can I pay by card?', ko: '카드로 결제할 수 있어요?' },
  { group: 'Chụp ảnh', zh: '可以帮我拍张照片吗？', py: 'Kěyǐ bāng wǒ pāi zhāng zhàopiàn ma?', vi: 'Bạn chụp giúp tôi một tấm ảnh được không?', en: 'Could you take a photo of me?', ko: '사진 좀 찍어 주실 수 있어요?' },
  { group: 'Chụp ảnh', zh: '这里可以拍照吗？', py: 'Zhèlǐ kěyǐ pāizhào ma?', vi: 'Ở đây có được chụp ảnh không?', en: 'Can I take photos here?', ko: '여기서 사진 찍어도 돼요?' },
  { group: 'Khách sạn', zh: '我要退房。', py: 'Wǒ yào tuìfáng.', vi: 'Tôi muốn trả phòng.', en: "I'd like to check out.", ko: '체크아웃할게요.' },
  { group: 'Khách sạn', zh: '可以寄存行李吗？', py: 'Kěyǐ jìcún xíngli ma?', vi: 'Tôi có thể gửi hành lý không?', en: 'Can I store my luggage?', ko: '짐을 맡길 수 있어요?' },
  { group: 'Khẩn cấp', zh: '请帮帮我！', py: 'Qǐng bāngbang wǒ!', vi: 'Làm ơn giúp tôi!', en: 'Please help me!', ko: '도와주세요!' },
  { group: 'Khẩn cấp', zh: '我需要医生。', py: 'Wǒ xūyào yīshēng.', vi: 'Tôi cần bác sĩ.', en: 'I need a doctor.', ko: '의사가 필요해요.' },
  { group: 'Khẩn cấp', zh: '请叫救护车。', py: 'Qǐng jiào jiùhùchē.', vi: 'Làm ơn gọi xe cấp cứu.', en: 'Please call an ambulance.', ko: '구급차를 불러 주세요.' },
  { group: 'Khẩn cấp', zh: '我迷路了。', py: 'Wǒ mílù le.', vi: 'Tôi bị lạc đường.', en: "I'm lost.", ko: '길을 잃었어요.' },
  { group: 'Khẩn cấp', zh: '我的护照丢了。', py: 'Wǒ de hùzhào diū le.', vi: 'Tôi bị mất hộ chiếu.', en: 'I lost my passport.', ko: '여권을 잃어버렸어요.' },
  { group: 'Khẩn cấp', zh: '洗手间在哪里？', py: 'Xǐshǒujiān zài nǎlǐ?', vi: 'Nhà vệ sinh ở đâu?', en: 'Where is the restroom?', ko: '화장실이 어디예요?' },
];
