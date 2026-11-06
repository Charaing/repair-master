'use strict';
/* =========================================================================
   REPAIR MASTER — 게임 데이터
   부품 백과 · 기기 모델(레이아웃/분해 구조) · 고장 · 의뢰 시나리오 · 업체 · 도구
   ========================================================================= */


/* 한국어 조사 자동 선택 */
const JOSA = { '을(를)': ['을', '를'], '이(가)': ['이', '가'], '은(는)': ['은', '는'], '와(과)': ['과', '와'], '(으)로': ['으로', '로'] };
function fixJosa(text) {
  if (typeof text !== 'string') return text;
  // 괄호가 끼어 있으면("히팅 패드(기본)이(가)") 괄호 앞 글자로 판단
  return text.replace(/([^\s(])(\([^)]*\))?(을\(를\)|이\(가\)|은\(는\)|와\(과\)|\(으\)로)/g, (m, ch, par, j) => {
    par = par || '';
    const code = ch.charCodeAt(0);
    let batchim;
    if (code >= 0xAC00 && code <= 0xD7A3) batchim = (code - 0xAC00) % 28;
    else if (/[0-9]/.test(ch)) batchim = '0136780'.includes(ch) ? 1 : 0;   // 영·일·삼·육·칠·팔·십
    else if (/[A-Za-z]/.test(ch)) batchim = /[lmnr]/i.test(ch) ? 1 : 0;
    else return m;
    const [withB, noB] = JOSA[j];
    if (j === '(으)로' && batchim === 8) return ch + par + '로';   // ㄹ 받침 + 로
    return ch + par + (batchim ? withB : noB);
  });
}
const WON = n => '₩' + Math.round(n).toLocaleString('ko-KR');

/* -------------------------------------------------------------------------
   부품 백과사전 (교과서 내용)
   lv 해금: 1=발견(실루엣) 2=식별(이름·기초) 3=작업 경험(위치·관계) 4=수리 경험(증상·진단·가격)
   ------------------------------------------------------------------------- */
const PART_TYPES = {
  display_oled: {
    name: 'OLED 디스플레이', en: 'OLED Display Assembly', cat: '화면',
    short: '픽셀 하나하나가 스스로 빛을 내는 화면 패널. 커버 유리, 터치 센서(디지타이저), 발광 패널이 한 덩어리로 접착되어 있다.',
    roles: ['영상 신호를 받아 화면에 표시', '터치 센서로 손가락 위치를 감지해 메인보드에 전달', '검은색을 픽셀을 꺼서 표현하므로 명암비가 높음'],
    location: '기기 앞면 전체. 플렉스 케이블이 프레임 틈을 지나 메인보드의 디스플레이 커넥터에 꽂힌다.',
    symptoms: ['낙하 후 화면에 세로/가로 줄', '검은 잉크가 번진 듯한 얼룩', '화면은 나오는데 일부 영역 터치 불가', '아예 화면이 켜지지 않음(진동·소리는 정상)', '오래 같은 화면을 띄워 생긴 잔상(번인)'],
    relations: '메인보드 디스플레이 커넥터와 연결. 일부 모델은 터치 신호용 커넥터가 따로 있다. 커넥터가 들뜨면 패널이 멀쩡해도 깜빡임·무화면이 생길 수 있다.',
    diagnose: '화면 출력 검사 → 터치 반응 검사 순서로 확인. 부팅은 되는데(진동/소리) 화면만 없다면 패널 또는 커넥터를 의심. 유리 아래 잉크 번짐이 보이면 패널 손상이 유력하다. 교체 전 커넥터 재장착을 먼저 시도해 볼 것.',
    caution: '패널은 매우 얇아 휘면 바로 손상된다. 배터리를 분리한 뒤 커넥터를 다뤄야 한다. (게임 속 가열 작업은 교육용 가상 조작이다.)',
    devices: '스마트폰(노바 X12, 픽시스 S3), 향후: 태블릿·스마트워치'
  },
  display_lcd: {
    name: 'LCD 디스플레이', en: 'LCD Display Assembly', cat: '화면',
    short: '액정이 빛을 통과시키거나 막아 영상을 만드는 화면. 스스로 빛나지 않아 뒤에서 비추는 백라이트가 필요하다.',
    roles: ['액정 셀로 빛의 양을 조절해 영상 표시', '백라이트(LED + 도광판)가 화면 전체를 비춤', '저가형은 터치 센서가 패널에 내장(인셀)된 경우가 많음'],
    location: '기기 앞면. 저가형 모델은 아래쪽 베젤(턱)이 두껍다. 플렉스는 메인보드 커넥터로 이어진다.',
    symptoms: ['화면이 매우 어둡지만 빛을 비추면 희미하게 보임(백라이트 고장)', '줄·번짐·검은 멍', '터치 불량', '화면 전체 무출력'],
    relations: '백라이트 전원은 메인보드에서 공급된다. 커넥터 접촉 불량, 패널 손상, 백라이트 회로 고장이 모두 "화면이 안 나와요"로 표현될 수 있다.',
    diagnose: '화면 출력 검사에서 "어두움/희미하게 보임"이 나오면 백라이트 계통을 의심한다. 완전한 무출력이면 커넥터 → 패널 순서로 확인.',
    caution: 'OLED보다 두껍지만 백라이트 필름이 쉽게 구겨진다.',
    devices: '스마트폰(루멘 A5), 향후: 노트북·게임기'
  },
  battery: {
    name: '배터리', en: 'Li-ion Polymer Battery', cat: '전원',
    short: '전기를 화학 에너지로 저장했다가 꺼내 쓰는 리튬이온 폴리머 셀과 보호회로의 묶음.',
    roles: ['기기 전체에 전원 공급', '보호회로(BMS)가 과충전·과방전·단락을 차단', '잔량·온도 정보를 메인보드에 보고'],
    location: '기기 중앙의 가장 넓은 칸. 늘어나는 접착 테이프(풀탭)로 프레임에 고정되고, 짧은 플렉스로 메인보드에 연결된다.',
    symptoms: ['배터리가 빨리 닳음', '잔량이 20~30% 남았는데 갑자기 꺼짐', '충전기를 꽂아야만 켜짐', '뒷판이 들뜨거나 화면이 밀려 올라옴(팽창)'],
    relations: '충전 포트 → 메인보드(전원 관리 회로) → 배터리 순서로 충전된다. 충전 불량이라도 배터리 탓이 아닐 수 있다.',
    diagnose: '배터리 상태 검사로 건강도(설계 용량 대비 실제 용량)를 확인. 80% 미만이면 교체 권장. 팽창은 육안·확대경으로 확인 가능. 소프트웨어가 전력을 과다 소모하는 경우도 있으니 소프트웨어 검사도 함께 볼 것.',
    caution: '현실에서 손상되거나 부푼 배터리는 화재 위험이 있다. 이 게임의 배터리 분리는 교육용 가상 미니게임이며 실제 절차가 아니다.',
    devices: '거의 모든 휴대 기기'
  },
  mainboard: {
    name: '메인보드', en: 'Logic Board / Mainboard', cat: '회로',
    short: '전자기기의 주요 회로와 부품들을 연결하고 데이터를 주고받도록 하는 핵심 기판.',
    roles: ['프로세서(AP)·메모리·저장장치를 연결', '모든 커넥터의 신호를 중계', '전원 관리 회로로 전압을 나눠 공급', '모뎀으로 통신 처리'],
    location: '보통 카메라 근처 위쪽. 차폐 브라켓 아래에 있고 여러 커넥터가 모여 있다.',
    symptoms: ['기기가 정상적으로 켜지지 않음', '특정 기능이 작동하지 않음', '여러 부품이 동시에 이상을 보임', '충전·전원이 모두 무반응'],
    relations: '모든 부품이 메인보드를 거친다. 그래서 다른 부품 고장도 메인보드 고장처럼 보일 수 있다.',
    diagnose: '주의: 동일한 증상이 나타나더라도 반드시 메인보드 고장인 것은 아니다. 배터리·버튼·커넥터·소프트웨어를 먼저 배제한 뒤 판단한다. 전원 검사에서 전류가 전혀 흐르지 않거나 비정상적으로 높으면 전원 관리 회로를 의심.',
    caution: '가장 비싼 부품. 불필요한 교체는 큰 손해다.',
    devices: '모든 전자기기'
  },
  shield: {
    name: '차폐 브라켓', en: 'EMI Shield Bracket', cat: '구조',
    short: '얇은 금속판. 전자파 간섭을 막고, 아래의 커넥터와 부품을 눌러 고정한다.',
    roles: ['전자파(EMI) 차단', '커넥터가 빠지지 않게 눌러 고정', '스피커·카메라 접점을 눌러 접촉 유지'],
    location: '메인보드 위, 커넥터가 몰려 있는 곳. 작은 나사 여러 개로 고정된다.',
    symptoms: ['자체 고장은 드묾', '빼먹고 조립하면 커넥터가 빠지거나 통화 스피커 접점이 떨어짐'],
    relations: '브라켓을 제거해야 배터리·디스플레이 커넥터에 접근할 수 있는 경우가 많다.',
    diagnose: '조립 후 특정 기능이 안 되면 브라켓 누락·나사 누락을 먼저 확인.',
    caution: '나사마다 길이가 다를 수 있다. 빠진 나사는 반드시 제자리에.',
    devices: '스마트폰, 태블릿, 노트북'
  },
  back_glass: {
    name: '후면 글라스', en: 'Rear Glass Panel', cat: '외장',
    short: '기기 뒷면을 덮는 강화 유리. 무선 충전 전파가 통과할 수 있도록 금속 대신 유리를 쓴다.',
    roles: ['내부 보호', '방수 실링(접착제)', '무선 충전·NFC 신호 통과'],
    location: '기기 뒷면 전체. 강한 접착제로 프레임에 붙어 있다.',
    symptoms: ['낙하 후 뒷면 깨짐', '배터리 팽창 시 들뜸'],
    relations: '열어야 내부에 접근 가능한 모델(노바 X12)이 있다. 재조립 시 새 접착 테이프가 없으면 방수 성능이 떨어진다.',
    diagnose: '외관 확인. 들떠 있다면 내부 배터리 팽창을 의심.',
    caution: '게임 속 가열은 가상 작업. 과열하면 내부 부품이 손상될 수 있다는 개념만 표현한다.',
    devices: '고급형 스마트폰'
  },
  back_cover: {
    name: '플라스틱 후면 커버', en: 'Plastic Back Cover', cat: '외장',
    short: '보급형 기기의 뒷면 덮개. 접착제 대신 플라스틱 걸쇠(클립)로 고정된다.',
    roles: ['내부 보호', '지문 센서·카메라 창 고정'],
    location: '기기 뒷면 전체. 테두리를 따라 클립이 걸려 있다.',
    symptoms: ['클립 파손 시 들뜸·삐걱거림'],
    relations: '열고 나면 안테나가 인쇄된 중간 플레이트가 보인다.',
    diagnose: '외관 확인.',
    caution: '클립은 한쪽부터 차례로 풀어야 부러지지 않는다.',
    devices: '보급형 스마트폰(루멘 A5)'
  },
  midplate: {
    name: '중간 플레이트(안테나 일체형)', en: 'Midplate with LDS Antenna', cat: '구조',
    short: '메인보드를 덮는 플라스틱 판. 표면에 금색 안테나 패턴이 인쇄(LDS)되어 있어 안테나 역할도 한다.',
    roles: ['메인보드·커넥터 고정', '셀룰러/와이파이 안테나 패턴 내장', '통화 스피커 접점 압착'],
    location: '보급형 모델의 후면 커버 바로 아래. 나사 8개 안팎으로 고정.',
    symptoms: ['안테나 패턴 손상 시 신호 약함', '빼먹으면 커넥터 이탈·통화 스피커 무음'],
    relations: '안테나 고장인데 별도 안테나 부품이 없다면 이 플레이트를 교체한다.',
    diagnose: '무선 연결 검사에서 신호가 약하지만 IMEI(모뎀)는 정상일 때 의심.',
    caution: '나사 개수가 많으니 위치를 기억할 것.',
    devices: '보급형 스마트폰'
  },
  camera_rear: {
    name: '후면 카메라 모듈', en: 'Rear Camera Module', cat: '카메라',
    short: '이미지 센서, 렌즈, 초점 구동부(AF), 손떨림 보정(OIS)이 하나로 묶인 모듈. 고급형은 여러 개의 카메라가 한 블록에 들어 있다.',
    roles: ['빛을 전기 신호로 바꾸는 이미지 센서', '렌즈 이동으로 초점 조절', 'OIS로 흔들림 보정'],
    location: '후면 위쪽 모서리. 메인보드 위에 얹혀 있고 브라켓이 눌러 고정.',
    symptoms: ['사진이 흐릿하고 초점이 안 잡힘', '카메라 앱이 검은 화면', '촬영 시 "딸깍"거리는 소리·떨림', '렌즈 커버 유리 깨짐'],
    relations: '렌즈 커버 유리(후면 글라스 쪽)만 깨진 경우와 모듈 자체 고장이 구분된다. 소프트웨어 검사에서 "미검출"이면 모듈·커넥터 문제.',
    diagnose: '카메라 작동 검사로 출력 상태 확인 → 소프트웨어 검사의 장치 목록으로 인식 여부 확인 → 확대경으로 렌즈 확인.',
    caution: '렌즈 면을 손으로 만지지 말 것.',
    devices: '스마트폰, 태블릿, 노트북(웹캠)'
  },
  camera_front: {
    name: '전면 카메라', en: 'Front Camera', cat: '카메라',
    short: '셀카·영상통화·얼굴 인식용 작은 카메라. 화면 구멍(펀치홀)이나 노치 아래에 위치.',
    roles: ['셀카·영상통화', '일부 기기에서 얼굴 인식 보조'],
    location: '앞면 상단 중앙. 통화 스피커와 붙어 있는 경우가 많다.',
    symptoms: ['전면 카메라만 검은 화면', '얼굴 인식 실패'],
    relations: '모델에 따라 통화 스피커와 같은 플렉스를 공유해, 하나가 고장 나면 둘 다 이상할 수 있다.',
    diagnose: '카메라 작동 검사에서 전·후면을 따로 확인.',
    caution: '작고 가벼워 핀셋으로 다룬다.',
    devices: '스마트폰, 태블릿, 노트북'
  },
  charge_port: {
    name: '충전 포트 모듈', en: 'Charging Port Board/Flex', cat: '전원',
    short: 'USB-C 단자와 그 주변 회로가 달린 작은 보드(또는 플렉스). 하단 마이크가 함께 달린 경우가 많다.',
    roles: ['충전기 전원을 메인보드로 전달', '데이터 통신', '하단 마이크·스피커 접점 연결(모델별)'],
    location: '기기 맨 아래. 스피커 모듈 밑에 깔려 있는 경우가 많다.',
    symptoms: ['충전기를 바꿔도 충전이 안 됨', '케이블을 움직이면 충전이 끊겼다 이어짐', '통화 시 상대가 내 목소리를 못 들음(마이크 일체형)', '포트 안 먼지·부식'],
    relations: '충전 포트 → (메인 플렉스) → 메인보드 경로로 연결. 포트가 멀쩡해도 플렉스나 전원 관리 회로 고장이면 충전이 안 된다.',
    diagnose: '충전 반응 검사 → 확대경으로 포트 내부(먼지/부식) 확인. 먼지는 브러시 청소로 해결될 수 있어 교체가 필요 없을 수도 있다.',
    caution: '포트 내부 핀이 휘지 않게 청소한다.',
    devices: '스마트폰, 태블릿, 무선 이어폰 케이스, 컨트롤러'
  },
  flex_cable: {
    name: '메인 플렉스 케이블', en: 'Main Flex Cable', cat: '연결',
    short: '얇고 휘어지는 필름 위에 구리 배선을 새긴 케이블. 위쪽 메인보드와 아래쪽 서브보드를 이어준다.',
    roles: ['충전 전원·데이터 전달', '하단 마이크·스피커·진동 신호 전달'],
    location: '배터리 옆 가장자리를 따라 길게 지나간다.',
    symptoms: ['충전·하단 마이크·스피커가 한꺼번에 안 됨', '낙하나 이전 수리 후 찢어짐'],
    relations: '여러 기능이 동시에 죽었는데 각 부품은 정상일 때 가장 먼저 의심할 부품.',
    diagnose: '여러 하단 기능 검사가 동시에 실패 → 확대경으로 플렉스 접힘/찢어짐 확인.',
    caution: '강하게 접으면 내부 배선이 끊어진다.',
    devices: '스마트폰, 노트북(디스플레이 케이블)'
  },
  speaker: {
    name: '라우드 스피커', en: 'Loudspeaker Module', cat: '오디오',
    short: '음악·벨소리·스피커폰 소리를 내는 하단 스피커. 울림통(인클로저)과 진동판이 한 모듈.',
    roles: ['미디어·벨소리 재생', '스피커폰 통화'],
    location: '기기 하단, 충전 포트 옆. 나사로 고정되고 금색 스프링 접점으로 연결.',
    symptoms: ['소리가 찢어짐·지직거림', '소리가 아예 안 남', '침수 후 작게 들림'],
    relations: '접점이 서브보드/포트 모듈에 닿아 있어, 그쪽 경로가 끊겨도 소리가 안 난다.',
    diagnose: '스피커 작동 검사에서 미디어 재생 확인. 통화 스피커와 구분해서 볼 것.',
    caution: '진동판에 이물질이 들어가지 않도록.',
    devices: '스마트폰, 태블릿, 노트북, 게임기'
  },
  earpiece: {
    name: '통화 스피커(리시버)', en: 'Earpiece Speaker', cat: '오디오',
    short: '귀에 대고 통화할 때 상대 목소리를 들려주는 작은 스피커.',
    roles: ['통화 음성 재생', '일부 모델은 스테레오 상단 채널'],
    location: '앞면 상단, 전면 카메라 옆. 브라켓·플레이트가 눌러 접점을 유지.',
    symptoms: ['통화할 때 상대방 목소리가 안 들림', '스피커폰으로 하면 들림'],
    relations: '"스피커폰은 되는데 귀에 대면 안 들려요"는 라우드 스피커가 아니라 이 부품 문제.',
    diagnose: '스피커 작동 검사의 통화 스피커 항목. 브라켓을 빼먹으면 접점이 떨어져 무음이 된다.',
    caution: '그물망(메시)에 먼지가 차도 소리가 작아진다.',
    devices: '스마트폰'
  },
  microphone: {
    name: '마이크', en: 'MEMS Microphone', cat: '오디오',
    short: '소리를 전기 신호로 바꾸는 초소형 MEMS 마이크.',
    roles: ['통화 음성 입력', '녹음·음성 비서'],
    location: '하단 마이크는 충전 포트 근처. 보급형은 고무 부트에 끼운 독립 부품, 고급형은 충전 포트 모듈에 납땜되어 있다.',
    symptoms: ['통화 시 상대가 내 목소리를 못 들음', '녹음하면 소리가 작거나 잡음'],
    relations: '노바 X12·픽시스 S3는 하단 마이크가 충전 포트 모듈에 붙어 있어, 포트 모듈을 바꾸면 마이크도 함께 바뀐다.',
    diagnose: '스피커 작동 검사의 마이크 녹음 항목.',
    caution: '마이크 구멍을 막는 먼지·방수 메시를 확인.',
    devices: '스마트폰, 이어폰, 노트북'
  },
  vibration: {
    name: '진동 모터', en: 'Vibration Motor (LRA/ERM)', cat: '기타',
    short: '알림 진동을 만드는 모터. 고급형은 선형 공진 액추에이터(LRA), 보급형은 동전형 편심 모터(ERM).',
    roles: ['알림·전화 진동', '터치 피드백(햅틱)'],
    location: '하단 또는 메인보드 근처.',
    symptoms: ['진동이 안 옴', '진동이 약하거나 덜덜거리는 소리'],
    relations: '노바 X12는 진동 모터가 서브보드에 연결되어 있어 메인 플렉스가 끊겨도 진동이 멈춘다.',
    diagnose: '하드웨어 자가진단의 진동 항목.',
    caution: '동전형은 접착식이라 핀셋으로 천천히 떼어낸다.',
    devices: '스마트폰, 컨트롤러, 스마트워치'
  },
  button_flex: {
    name: '버튼 플렉스', en: 'Button Flex Cable', cat: '연결',
    short: '전원·음량 버튼 아래의 돔 스위치가 붙은 가는 플렉스.',
    roles: ['전원 버튼 입력', '음량 버튼 입력'],
    location: '프레임 옆 가장자리 안쪽.',
    symptoms: ['전원 버튼을 눌러도 반응 없음(충전기 연결 시엔 켜짐)', '음량 버튼 무반응', '버튼이 눌린 채로 인식'],
    relations: '전원 버튼 고장은 "전원이 안 켜져요"로 나타나 배터리·메인보드 고장과 헷갈린다.',
    diagnose: '전원 검사에서 "충전기 연결 시 부팅"이고 배터리 건강도가 정상이라면 버튼 계통을 의심. 하드웨어 자가진단으로 버튼 입력 확인.',
    caution: '돔 스위치는 작고 쉽게 찌그러진다.',
    devices: '스마트폰, 태블릿'
  },
  antenna: {
    name: '안테나 모듈', en: 'Antenna Module', cat: '통신',
    short: '셀룰러(5G/LTE) 신호를 주고받는 안테나 플렉스와 동축 케이블.',
    roles: ['통신 전파 송수신', '모뎀과 동축 케이블로 연결'],
    location: '상단 또는 하단 모서리. 얇은 동축 케이블이 메인보드 커넥터로 이어진다.',
    symptoms: ['안테나 표시가 잘 안 뜸', '통화가 자주 끊김'],
    relations: '모뎀(메인보드) 고장과 증상이 비슷하다. 모뎀이 고장 나면 IMEI가 읽히지 않는다는 점이 차이.',
    diagnose: '무선 연결 검사: 신호 세기와 IMEI 인식 여부를 함께 본다. 신호 약함 + IMEI 정상 → 안테나 유력.',
    caution: '동축 커넥터는 수직으로 들어 올려 분리.',
    devices: '스마트폰, 태블릿, 노트북(와이파이)'
  },
  coil: {
    name: '무선 충전 코일·NFC', en: 'Wireless Charging Coil & NFC', cat: '전원',
    short: '구리선을 원형으로 감은 코일. 충전 패드의 자기장을 받아 전기로 바꾼다. 바깥쪽 사각 루프는 NFC(교통카드·결제) 안테나.',
    roles: ['무선 충전 수신', 'NFC 통신'],
    location: '후면 글라스 바로 아래, 배터리 위.',
    symptoms: ['무선 충전 패드에 올려도 반응 없음', '교통카드 인식 불량'],
    relations: '유선 충전이 되는데 무선만 안 되면 이 부품을 의심.',
    diagnose: '무선 연결 검사의 무선 충전 항목.',
    caution: '얇은 필름이라 접히지 않게.',
    devices: '고급형 스마트폰(노바 X12), 이어폰 케이스'
  },
  heatsink: {
    name: '방열 시트·베이퍼 챔버', en: 'Vapor Chamber / Graphite Sheet', cat: '냉각',
    short: '프로세서 열을 넓게 퍼뜨리는 얇은 구리판(내부에 소량의 액체가 증발·응축하며 열을 옮김)과 흑연 시트.',
    roles: ['AP 발열 분산', '성능 저하(스로틀링) 완화'],
    location: '메인보드와 프레임 사이.',
    symptoms: ['고장은 드묾', '찢어지면 발열·성능 저하'],
    relations: '스마트폰은 팬 없이 이 부품만으로 열을 식힌다. 노트북은 여기에 냉각팬이 추가된다.',
    diagnose: '메인보드를 들어내면 보인다. 찢어짐 여부를 육안 확인.',
    caution: '접히면 성능이 떨어진다.',
    devices: '스마트폰, 태블릿, 노트북'
  },
  soc: {
    name: '프로세서(AP)', en: 'Application Processor (SoC)', cat: '회로',
    short: 'CPU·GPU·신경망 처리장치 등이 하나의 칩에 들어간 시스템 온 칩. 기기의 두뇌.',
    roles: ['앱 실행 연산', '그래픽 처리', '영상·카메라 신호 처리'],
    location: '메인보드 중앙의 가장 큰 칩. 위에 메모리가 겹쳐 쌓인 경우도 있다.',
    symptoms: ['부팅 불가, 재부팅 반복', '발열 과다'],
    relations: '칩 단독 교체는 게임에서 다루지 않고 메인보드 단위로 교체한다.',
    diagnose: '다른 원인을 모두 배제한 뒤 최후에 의심.',
    caution: '현실의 칩 재납땜(리볼링)은 고난도·고온 작업으로 게임에서 구현하지 않는다.',
    devices: '모든 스마트 기기'
  },
  ram: {
    name: '메모리(RAM)', en: 'LPDDR Memory', cat: '회로',
    short: '실행 중인 앱과 데이터를 잠시 올려두는 고속 작업 공간. 전원이 꺼지면 내용이 사라진다.',
    roles: ['프로세서의 작업 공간', '여러 앱을 동시에 띄움'],
    location: '스마트폰은 AP 옆이나 위에 납땜. 노트북은 교체 가능한 모듈형도 있다.',
    symptoms: ['앱이 자주 종료됨', '부팅 중 멈춤'],
    relations: '스마트폰에서는 메인보드 일부. 노트북에서는 개별 교체 부품(향후 콘텐츠).',
    diagnose: '소프트웨어 검사에서 메모리 오류 로그 확인.',
    caution: '정전기에 약하다.',
    devices: '모든 전자기기'
  },
  storage: {
    name: '저장장치(UFS)', en: 'Flash Storage (UFS)', cat: '회로',
    short: '사진·앱·운영체제가 저장되는 낸드 플래시 칩. 전원이 꺼져도 데이터가 유지된다.',
    roles: ['운영체제와 사용자 데이터 저장'],
    location: '메인보드에 납땜된 사각형 칩.',
    symptoms: ['저장 공간 오류', '부팅 루프(손상 시)'],
    relations: '부팅 루프는 저장장치 손상보다 소프트웨어 손상이 훨씬 흔하다.',
    diagnose: '소프트웨어 검사로 파일 시스템 상태 확인.',
    caution: '메인보드를 교체하면 고객 데이터가 사라진다는 점을 안내해야 한다.',
    devices: '스마트폰, 태블릿 / 노트북은 SSD'
  },
  pmic: {
    name: '전원 관리 회로(PMIC)', en: 'Power Management IC', cat: '회로',
    short: '배터리 전압을 여러 전압으로 나눠 각 부품에 공급하고 충전을 제어하는 칩.',
    roles: ['전압 변환·분배', '충전 제어', '전원 버튼 신호 처리'],
    location: '메인보드 위, 배터리 커넥터 근처.',
    symptoms: ['전원·충전 모두 무반응', '충전기 연결 시 전류 0A 또는 비정상적으로 큼'],
    relations: '배터리·충전 포트·버튼이 모두 멀쩡한데 켜지지도 충전되지도 않으면 의심.',
    diagnose: '전원 검사의 전류값이 핵심 단서. 고급 진단 보드가 있으면 단락 여부까지 확인할 수 있다.',
    caution: '게임에서는 메인보드 교체로 수리한다.',
    devices: '모든 전자기기'
  },
  fan: {
    name: '냉각팬', en: 'Cooling Fan', cat: '냉각', future: '노트북',
    short: '날개를 돌려 공기를 밀어내 방열판의 열을 밖으로 빼내는 팬.',
    roles: ['방열판의 열 배출', '온도에 따라 회전 속도 조절'],
    location: '노트북·데스크톱·게임 콘솔 내부, 방열판 끝.',
    symptoms: ['소음이 커짐', '먼지가 쌓여 과열·강제 종료'],
    relations: '방열판과 함께 동작한다. 스마트폰에는 없다.',
    diagnose: '노트북 콘텐츠에서 다룰 예정.',
    caution: '향후 콘텐츠.',
    devices: '노트북, 데스크톱, 게임 콘솔 (현재 버전 미구현)'
  },
  ssd: {
    name: 'SSD', en: 'Solid State Drive', cat: '저장', future: '노트북',
    short: '노트북·PC용 교체 가능한 플래시 저장장치(M.2 규격 등).',
    roles: ['운영체제·데이터 저장'],
    location: '노트북 메인보드의 M.2 슬롯.',
    symptoms: ['부팅 장치 없음', '느려짐'],
    relations: '스마트폰의 UFS와 같은 역할이지만 교체가 가능하다.',
    diagnose: '노트북 콘텐츠에서 다룰 예정.',
    caution: '향후 콘텐츠.',
    devices: '노트북, 데스크톱 (현재 버전 미구현)'
  }
};
const BOOK_ORDER = ['display_oled','display_lcd','battery','mainboard','soc','ram','storage','pmic','shield','back_glass','back_cover','midplate','camera_rear','camera_front','charge_port','flex_cable','speaker','earpiece','microphone','vibration','button_flex','antenna','coil','heatsink','fan','ssd'];

/* -------------------------------------------------------------------------
   기기 모델 — 좌표계: 본체 360 x 760. side별 좌표(앞면/뒷면은 각자 보이는 그대로)
   slot: id,type,side,z,x,y,w,h,coveredBy[],screws[[x,y]],adhesive{kind:'glue'|'clip'|'tab',heat},hinge,tool
   conn: id,owner,board,side,x,y,w,h,coveredBy[],ribbonFrom?
   paths: 기능 → 필요한 슬롯/커넥터(c:) 경로
   ------------------------------------------------------------------------- */
const MODELS = {
  nova: {
    id: 'nova', brand: 'NOVA', name: '노바 X12', code: 'NX12', tier: '플래그십', year: 2025,
    desc: '후면 글라스를 열어 분해하는 고급형. 무선 충전, 트리플 카메라, 서브보드 구조.',
    openSide: 'back', shell: { back: 'back_glass', front: 'display' },
    style: { back: '#1c2b4b', back2: '#36507f', frame: '#a8b0ba', pcb: '#1d3a56', accent: '#5fa8ff', camCount: 3 },
    difficulty: 3, priceMult: 1,
    slots: [
      { id: 'heatsink', type: 'heatsink', side: 'back', z: 1, x: 44, y: 86, w: 272, h: 200, coveredBy: ['mainboard'], tool: 'tweezers' },
      { id: 'mainboard', type: 'mainboard', side: 'back', z: 2, x: 34, y: 80, w: 292, h: 215, coveredBy: ['bracket_main', 'bracket_top', 'camera_rear'], screws: [[60, 250], [300, 140], [232, 204]],
        chips: [{ type: 'soc', x: 150, y: 70, w: 70, h: 64 }, { type: 'ram', x: 228, y: 70, w: 42, h: 30 }, { type: 'storage', x: 228, y: 108, w: 42, h: 28 }, { type: 'pmic', x: 120, y: 160, w: 34, h: 28 }] },
      { id: 'camera_rear', type: 'camera_rear', side: 'back', z: 3, x: 44, y: 92, w: 100, h: 120, coveredBy: ['bracket_main'] },
      { id: 'camera_front', type: 'camera_front', side: 'back', z: 3, x: 170, y: 34, w: 22, h: 24, coveredBy: ['bracket_top'], tool: 'tweezers' },
      { id: 'earpiece', type: 'earpiece', side: 'back', z: 3, x: 206, y: 34, w: 62, h: 22, coveredBy: ['bracket_top'], tool: 'tweezers' },
      { id: 'antenna', type: 'antenna', side: 'back', z: 3, x: 280, y: 30, w: 46, h: 44, coveredBy: ['bracket_top'] },
      { id: 'button_flex', type: 'button_flex', side: 'back', z: 3, x: 14, y: 150, w: 12, h: 210, coveredBy: [] },
      { id: 'flex_cable', type: 'flex_cable', side: 'back', z: 3, x: 308, y: 296, w: 16, h: 352, coveredBy: ['bracket_main', 'speaker'] },
      { id: 'charge_port', type: 'charge_port', side: 'back', z: 2, x: 40, y: 640, w: 280, h: 88, coveredBy: ['speaker'], screws: [[52, 716], [150, 716]] },
      { id: 'vibration', type: 'vibration', side: 'back', z: 3, x: 44, y: 604, w: 64, h: 30, coveredBy: [], screws: [[100, 619]] },
      { id: 'battery', type: 'battery', side: 'back', z: 4, x: 56, y: 312, w: 248, h: 290, coveredBy: ['coil'], adhesive: { kind: 'tab' } },
      { id: 'speaker', type: 'speaker', side: 'back', z: 4, x: 196, y: 604, w: 130, h: 88, coveredBy: [], screws: [[206, 614], [316, 614], [262, 684]] },
      { id: 'bracket_main', type: 'shield', side: 'back', z: 5, x: 34, y: 80, w: 292, h: 222, coveredBy: ['coil'], screws: [[46, 92], [314, 92], [46, 290], [292, 292], [180, 250]], label: '메인 차폐 브라켓' },
      { id: 'bracket_top', type: 'shield', side: 'back', z: 5, x: 150, y: 26, w: 180, h: 56, coveredBy: [], screws: [[160, 70], [322, 70]], label: '상단 브라켓' },
      { id: 'coil', type: 'coil', side: 'back', z: 6, x: 70, y: 206, w: 220, h: 320, coveredBy: [] },
      { id: 'back_glass', type: 'back_glass', side: 'back', z: 9, x: 0, y: 0, w: 360, h: 760, coveredBy: [], adhesive: { kind: 'glue', heat: true } },
      { id: 'display', type: 'display_oled', side: 'front', z: 9, x: 0, y: 0, w: 360, h: 760, coveredBy: [], adhesive: { kind: 'glue', heat: true } }
    ],
    conns: [
      { id: 'c_batt', owner: 'battery', board: 'mainboard', side: 'back', x: 166, y: 278, w: 30, h: 14, coveredBy: ['bracket_main'], label: '배터리 커넥터' },
      { id: 'c_disp', owner: 'display', board: 'mainboard', side: 'back', x: 236, y: 248, w: 34, h: 16, coveredBy: ['bracket_main'], ribbonFrom: [253, 308], label: '디스플레이 커넥터' },
      { id: 'c_cam', owner: 'camera_rear', board: 'mainboard', side: 'back', x: 150, y: 176, w: 26, h: 12, coveredBy: ['bracket_main'], label: '후면 카메라 커넥터' },
      { id: 'c_fcam', owner: 'camera_front', board: 'mainboard', side: 'back', x: 186, y: 86, w: 22, h: 10, coveredBy: ['bracket_main'], label: '전면 카메라 커넥터' },
      { id: 'c_ant', owner: 'antenna', board: 'mainboard', side: 'back', x: 296, y: 96, w: 22, h: 10, coveredBy: ['bracket_main'], label: '안테나 동축 커넥터' },
      { id: 'c_btn', owner: 'button_flex', board: 'mainboard', side: 'back', x: 36, y: 170, w: 16, h: 22, coveredBy: ['bracket_main'], label: '버튼 플렉스 커넥터' },
      { id: 'c_flex1', owner: 'flex_cable', board: 'mainboard', side: 'back', x: 300, y: 276, w: 24, h: 14, coveredBy: ['bracket_main'], label: '메인 플렉스(상단)' },
      { id: 'c_flex2', owner: 'flex_cable', board: 'charge_port', side: 'back', x: 300, y: 650, w: 24, h: 14, coveredBy: ['speaker'], label: '메인 플렉스(하단)' },
      { id: 'c_vib', owner: 'vibration', board: 'charge_port', side: 'back', x: 112, y: 644, w: 20, h: 12, coveredBy: [], label: '진동 모터 커넥터' },
      { id: 'c_coil', owner: 'coil', board: 'mainboard', side: 'back', x: 292, y: 214, w: 22, h: 14, coveredBy: [], z: 6.5, label: '무선 충전 코일 커넥터' }
    ],
    paths: {
      battery: ['battery', 'c:c_batt'],
      display: ['display', 'c:c_disp'], touch: ['display', 'c:c_disp'],
      charge: ['charge_port', 'flex_cable', 'c:c_flex1', 'c:c_flex2'],
      mic: ['charge_port', 'flex_cable', 'c:c_flex1', 'c:c_flex2'],
      speaker: ['speaker', 'charge_port', 'flex_cable', 'c:c_flex1', 'c:c_flex2'],
      vibration: ['vibration', 'c:c_vib', 'charge_port', 'flex_cable', 'c:c_flex1', 'c:c_flex2'],
      camera_rear: ['camera_rear', 'c:c_cam'], camera_front: ['camera_front', 'c:c_fcam'],
      earpiece: ['earpiece', 'bracket_top'],
      buttons: ['button_flex', 'c:c_btn'],
      signal: ['antenna', 'c:c_ant'],
      wireless_charge: ['coil', 'c:c_coil']
    },
    lci: { side: 'back', x: 30, y: 420 },
    port: { side: 'back', x: 160, y: 744 },
    edge: { t: 30, spk: [228, 304], mic: [56, 100], micN: 4 }
  },

  pixis: {
    id: 'pixis', brand: 'PIXIS', name: '픽시스 S3', code: 'PS3', tier: '중급형', year: 2024,
    desc: '화면을 책처럼 열어 분해하는 전면 개방형. 후면 글라스는 프레임 일체형이라 분해 불가.',
    openSide: 'front', shell: { front: 'display' }, backFixed: true,
    style: { back: '#d8d0c4', back2: '#f1ebe2', frame: '#c9c2b6', pcb: '#20382c', accent: '#d9a86c', camCount: 2 },
    difficulty: 2, priceMult: 0.78,
    slots: [
      { id: 'mainboard', type: 'mainboard', side: 'front', z: 2, x: 228, y: 56, w: 106, h: 470, coveredBy: ['plate', 'cam_bracket', 'camera_rear'], screws: [[242, 330], [320, 330], [242, 500], [320, 500]],
        chips: [{ type: 'soc', x: 18, y: 290, w: 68, h: 62 }, { type: 'ram', x: 18, y: 360, w: 40, h: 26 }, { type: 'storage', x: 62, y: 360, w: 30, h: 26 }, { type: 'pmic', x: 30, y: 400, w: 32, h: 26 }] },
      { id: 'camera_rear', type: 'camera_rear', side: 'front', z: 3, x: 238, y: 176, w: 86, h: 96, coveredBy: ['cam_bracket'] },
      { id: 'camera_front', type: 'camera_front', side: 'front', z: 3, x: 160, y: 22, w: 26, h: 22, coveredBy: ['ear_bracket'], tool: 'tweezers' },
      { id: 'earpiece', type: 'earpiece', side: 'front', z: 3, x: 196, y: 20, w: 60, h: 20, coveredBy: ['ear_bracket'], tool: 'tweezers' },
      { id: 'antenna', type: 'antenna', side: 'front', z: 3, x: 40, y: 60, w: 120, h: 26, coveredBy: [] },
      { id: 'button_flex', type: 'button_flex', side: 'front', z: 3, x: 14, y: 150, w: 12, h: 200, coveredBy: [] },
      { id: 'charge_port', type: 'charge_port', side: 'front', z: 2, x: 110, y: 706, w: 150, h: 42, coveredBy: ['speaker', 'vibration'], screws: [[120, 738], [250, 738]] },
      { id: 'vibration', type: 'vibration', side: 'front', z: 3, x: 40, y: 660, w: 110, h: 40, coveredBy: [], screws: [[48, 680], [142, 680]] },
      { id: 'speaker', type: 'speaker', side: 'front', z: 4, x: 214, y: 600, w: 110, h: 90, coveredBy: [], screws: [[222, 610], [316, 610], [268, 682]] },
      { id: 'battery', type: 'battery', side: 'front', z: 4, x: 40, y: 250, w: 186, h: 400, coveredBy: [], adhesive: { kind: 'tab' } },
      { id: 'cam_bracket', type: 'shield', side: 'front', z: 5, x: 232, y: 172, w: 98, h: 126, coveredBy: [], screws: [[242, 182], [320, 182], [242, 288]], label: '카메라 브라켓' },
      { id: 'ear_bracket', type: 'shield', side: 'front', z: 5, x: 120, y: 14, w: 150, h: 58, coveredBy: [], screws: [[132, 26], [258, 26], [132, 62]], label: '통화 스피커 브라켓' },
      { id: 'plate', type: 'shield', side: 'front', z: 6, x: 236, y: 76, w: 86, h: 94, coveredBy: [], screws: [[244, 84], [314, 84], [244, 162], [314, 162]], label: '커넥터 실드 플레이트' },
      { id: 'display', type: 'display_oled', side: 'front', z: 9, x: 0, y: 0, w: 360, h: 760, coveredBy: [], adhesive: { kind: 'glue', heat: true }, hinge: true, screws: [[150, 754], [210, 754]] }
    ],
    conns: [
      { id: 'c_disp', owner: 'display', board: 'mainboard', side: 'front', x: 260, y: 88, w: 40, h: 12, coveredBy: ['plate'], label: '디스플레이 커넥터' },
      { id: 'c_touch', owner: 'display', board: 'mainboard', side: 'front', x: 260, y: 108, w: 40, h: 12, coveredBy: ['plate'], label: '터치 커넥터' },
      { id: 'c_batt', owner: 'battery', board: 'mainboard', side: 'front', x: 260, y: 136, w: 40, h: 14, coveredBy: ['plate'], label: '배터리 커넥터' },
      { id: 'c_cam', owner: 'camera_rear', board: 'mainboard', side: 'front', x: 286, y: 280, w: 30, h: 12, coveredBy: ['cam_bracket'], label: '후면 카메라 커넥터' },
      { id: 'c_fcam', owner: 'camera_front', board: 'mainboard', side: 'front', x: 232, y: 58, w: 26, h: 12, coveredBy: ['ear_bracket'], label: '전면 카메라·리시버 커넥터' },
      { id: 'c_btn', owner: 'button_flex', board: 'mainboard', side: 'front', x: 234, y: 330, w: 20, h: 12, coveredBy: [], label: '버튼 플렉스 커넥터' },
      { id: 'c_ant', owner: 'antenna', board: 'mainboard', side: 'front', x: 234, y: 352, w: 22, h: 12, coveredBy: [], label: '안테나 동축 커넥터' },
      { id: 'c_port', owner: 'charge_port', board: 'mainboard', side: 'front', x: 290, y: 512, w: 32, h: 14, coveredBy: [], label: '충전 포트 커넥터' },
      { id: 'c_vib', owner: 'vibration', board: 'charge_port', side: 'front', x: 156, y: 708, w: 18, h: 12, coveredBy: [], label: '진동 모터 커넥터' }
    ],
    paths: {
      battery: ['battery', 'c:c_batt'],
      display: ['display', 'c:c_disp'], touch: ['display', 'c:c_touch'],
      charge: ['charge_port', 'c:c_port'],
      mic: ['charge_port', 'c:c_port'],
      speaker: ['speaker', 'charge_port', 'c:c_port'],
      vibration: ['vibration', 'c:c_vib', 'charge_port', 'c:c_port'],
      camera_rear: ['camera_rear', 'c:c_cam'],
      camera_front: ['camera_front', 'c:c_fcam'],
      earpiece: ['earpiece', 'ear_bracket', 'c:c_fcam'],
      buttons: ['button_flex', 'c:c_btn'],
      signal: ['antenna', 'c:c_ant']
    },
    lci: { side: 'front', x: 300, y: 560 },
    port: { side: 'front', x: 160, y: 746 },
    edge: { t: 34, spk: [244, 304], mic: [58, 92], micN: 3, screws: { slot: 'display', xs: [128, 232] } }
  },

  lumen: {
    id: 'lumen', brand: 'LUMEN', name: '루멘 A5', code: 'LA5', tier: '보급형', year: 2023,
    desc: '클립식 플라스틱 커버와 나사 8개짜리 중간 플레이트를 가진 보급형 LCD 모델. 부품이 저렴하고 구조가 단순.',
    openSide: 'back', shell: { back: 'back_cover', front: 'display' },
    style: { back: '#2f5f52', back2: '#4b8a77', frame: '#3a3f44', pcb: '#1f4a2f', accent: '#7fe0b0', camCount: 2 },
    difficulty: 1, priceMult: 0.45,
    slots: [
      { id: 'mainboard', type: 'mainboard', side: 'back', z: 2, x: 28, y: 30, w: 304, h: 262, coveredBy: ['midplate', 'camera_rear', 'vibration'], screws: [[60, 200], [300, 120]],
        chips: [{ type: 'soc', x: 120, y: 90, w: 66, h: 60 }, { type: 'ram', x: 194, y: 92, w: 40, h: 28 }, { type: 'storage', x: 194, y: 126, w: 40, h: 26 }, { type: 'pmic', x: 80, y: 200, w: 32, h: 26 }] },
      { id: 'camera_rear', type: 'camera_rear', side: 'back', z: 3, x: 44, y: 44, w: 56, h: 120, coveredBy: ['midplate'] },
      { id: 'camera_front', type: 'camera_front', side: 'back', z: 3, x: 168, y: 36, w: 24, h: 24, coveredBy: ['midplate'], tool: 'tweezers' },
      { id: 'earpiece', type: 'earpiece', side: 'back', z: 3, x: 214, y: 36, w: 56, h: 18, coveredBy: ['midplate'], tool: 'tweezers' },
      { id: 'vibration', type: 'vibration', side: 'back', z: 3, x: 290, y: 236, w: 30, h: 30, coveredBy: ['midplate'], tool: 'tweezers', round: true },
      { id: 'button_flex', type: 'button_flex', side: 'back', z: 3, x: 334, y: 140, w: 12, h: 180, coveredBy: [] },
      { id: 'flex_cable', type: 'flex_cable', side: 'back', z: 3, x: 14, y: 280, w: 14, h: 360, coveredBy: ['midplate', 'speaker'] },
      { id: 'charge_port', type: 'charge_port', side: 'back', z: 2, x: 40, y: 626, w: 280, h: 98, coveredBy: ['speaker', 'microphone'], screws: [[60, 640], [300, 640]] },
      { id: 'microphone', type: 'microphone', side: 'back', z: 3, x: 150, y: 690, w: 30, h: 20, coveredBy: ['speaker'], tool: 'tweezers' },
      { id: 'battery', type: 'battery', side: 'back', z: 4, x: 48, y: 304, w: 264, h: 296, coveredBy: [], adhesive: { kind: 'tab' } },
      { id: 'midplate', type: 'midplate', side: 'back', z: 6, x: 24, y: 26, w: 312, h: 272, coveredBy: [], screws: [[38, 40], [180, 40], [322, 40], [38, 170], [322, 170], [38, 284], [180, 284], [322, 284]] },
      { id: 'speaker', type: 'speaker', side: 'back', z: 6, x: 26, y: 608, w: 308, h: 126, coveredBy: [], screws: [[40, 620], [320, 620], [40, 722], [320, 722]], wide: true },
      { id: 'back_cover', type: 'back_cover', side: 'back', z: 9, x: 0, y: 0, w: 360, h: 760, coveredBy: [], adhesive: { kind: 'clip' } },
      { id: 'display', type: 'display_lcd', side: 'front', z: 9, x: 0, y: 0, w: 360, h: 760, coveredBy: [], adhesive: { kind: 'glue', heat: true } }
    ],
    conns: [
      { id: 'c_batt', owner: 'battery', board: 'mainboard', side: 'back', x: 150, y: 272, w: 32, h: 14, coveredBy: ['midplate'], label: '배터리 커넥터' },
      { id: 'c_disp', owner: 'display', board: 'mainboard', side: 'back', x: 226, y: 196, w: 36, h: 14, coveredBy: ['midplate'], ribbonFrom: [244, 300], label: 'LCD 커넥터' },
      { id: 'c_cam', owner: 'camera_rear', board: 'mainboard', side: 'back', x: 108, y: 120, w: 26, h: 12, coveredBy: ['midplate'], label: '후면 카메라 커넥터' },
      { id: 'c_fcam', owner: 'camera_front', board: 'mainboard', side: 'back', x: 200, y: 66, w: 24, h: 12, coveredBy: ['midplate'], label: '전면 카메라 커넥터' },
      { id: 'c_vib', owner: 'vibration', board: 'mainboard', side: 'back', x: 262, y: 246, w: 20, h: 10, coveredBy: ['midplate'], label: '진동 모터 커넥터' },
      { id: 'c_btn', owner: 'button_flex', board: 'mainboard', side: 'back', x: 306, y: 176, w: 20, h: 12, coveredBy: ['midplate'], label: '버튼 플렉스 커넥터' },
      { id: 'c_flex1', owner: 'flex_cable', board: 'mainboard', side: 'back', x: 32, y: 262, w: 24, h: 14, coveredBy: ['midplate'], label: '메인 플렉스(상단)' },
      { id: 'c_flex2', owner: 'flex_cable', board: 'charge_port', side: 'back', x: 30, y: 644, w: 24, h: 14, coveredBy: ['speaker'], label: '메인 플렉스(하단)' }
    ],
    paths: {
      battery: ['battery', 'c:c_batt'],
      display: ['display', 'c:c_disp'], touch: ['display', 'c:c_disp'],
      charge: ['charge_port', 'flex_cable', 'c:c_flex1', 'c:c_flex2'],
      mic: ['microphone', 'charge_port', 'flex_cable', 'c:c_flex1', 'c:c_flex2'],
      speaker: ['speaker', 'charge_port', 'flex_cable', 'c:c_flex1', 'c:c_flex2'],
      vibration: ['vibration', 'c:c_vib'],
      camera_rear: ['camera_rear', 'c:c_cam'], camera_front: ['camera_front', 'c:c_fcam'],
      earpiece: ['earpiece', 'midplate'],
      buttons: ['button_flex', 'c:c_btn'],
      signal: ['midplate']
    },
    lci: { side: 'back', x: 318, y: 420 },
    port: { side: 'back', x: 160, y: 744 },
    edge: { t: 38, spk: [222, 306], mic: [70, 96], micN: 2, jack: 40 }
  }
};
const MODEL_IDS = ['lumen', 'pixis', 'nova'];

/* 부품 가격표(일반 업체 기준, 시장가 1.0) */
const BASE_PRICE = {
  display_oled: 168000, display_lcd: 115000, battery: 40000, mainboard: 250000, shield: 7000, back_glass: 26000, back_cover: 18000,
  midplate: 24000, camera_rear: 62000, camera_front: 18000, charge_port: 21000, flex_cable: 15000, speaker: 14000, earpiece: 10000,
  microphone: 6000, vibration: 9000, button_flex: 8000, antenna: 10000, coil: 16000, heatsink: 6000
};
/* 표준 공임(고객이 '적정'하다고 느끼는 수준) */
const LABOR = {
  display_oled: 35000, display_lcd: 25000, battery: 20000, mainboard: 45000, shield: 5000, back_glass: 30000, back_cover: 5000,
  midplate: 20000, camera_rear: 25000, camera_front: 25000, charge_port: 25000, flex_cable: 30000, speaker: 18000, earpiece: 22000,
  microphone: 20000, vibration: 18000, button_flex: 30000, antenna: 25000, coil: 20000, heatsink: 15000,
  software: 20000, cleaning: 12000, reseat: 15000
};
function skuOf(model, slot) { return model + ':' + slot; }
function slotDef(modelId, slotId) { return MODELS[modelId].slots.find(s => s.id === slotId); }
function skuName(sku) {
  if (sku === 'adhesive') return '접착 테이프 시트';
  const [m, s] = sku.split(':'); const sd = slotDef(m, s);
  return MODELS[m].name + ' ' + (sd.label || PART_TYPES[sd.type].name);
}
function skuBasePrice(sku) {
  if (sku === 'adhesive') return 3000;
  const [m, s] = sku.split(':'); const sd = slotDef(m, s);
  return Math.round(BASE_PRICE[sd.type] * MODELS[m].priceMult / 100) * 100;
}
const ALL_SKUS = (() => { const a = []; MODEL_IDS.forEach(m => MODELS[m].slots.forEach(s => a.push(skuOf(m, s.id)))); a.push('adhesive'); return a; })();

/* -------------------------------------------------------------------------
   고장 정의 — slots: 적용 슬롯 후보(모델에 존재하는 첫 번째), eff: 기능별 상태
   ------------------------------------------------------------------------- */
const FAULTS = {
  disp_lines: { name: '디스플레이 패널 손상(줄·번짐)', slots: ['display'], eff: { display: 'lines', touch: 'partial' }, crack: true,
    say: ['화면에 줄이 생기고 터치도 잘 안 돼요.', '화면에 초록색 줄이 생겼고 아래쪽 터치가 안 먹어요.', '화면에 검은 얼룩이 번지고 줄이 가요.'],
    visual: { need: 1, text: '커버 유리가 깨져 있고, 그 아래 패널에 잉크가 번진 듯한 검은 얼룩이 보인다.' } },
  disp_dead: { name: '디스플레이 패널 무출력', slots: ['display'], eff: { display: 'none', touch: 'none' }, crack: true,
    say: ['화면이 아예 안 나와요. 근데 전화 오면 진동은 와요.', '화면이 까맣게 나와요. 소리는 나는 것 같아요.'],
    visual: { need: 1, text: '유리 모서리에 충격 흔적. 패널 가장자리에 미세한 금이 보인다.' } },
  touch_dead: { name: '터치 센서(디지타이저) 고장', slots: ['display'], eff: { touch: 'none' },
    say: ['화면은 나오는데 터치가 하나도 안 돼요.', '터치가 안 먹어요. 화면은 멀쩡한데...'],
    visual: { need: 2, text: '패널 뒷면 터치 센서 플렉스에 눌린 자국이 있다.' } },
  lcd_backlight: { name: 'LCD 백라이트 고장', slots: ['display'], eff: { display: 'dark' }, lcdOnly: true,
    say: ['화면이 안 나와요. 근데 전화 오면 진동은 와요.', '화면이 엄청 어두워요. 거의 안 보여요.'],
    visual: { need: 2, text: '백라이트 필름 가장자리가 들떠 있고, 백라이트 LED 줄 일부가 검게 탔다.' } },
  disp_loose: { name: '디스플레이 커넥터 접촉 불량', conn: 'c_disp',
    say: ['떨어뜨린 뒤로 화면이 깜빡거리다가 꺼져요.', '화면이 안 나와요. 근데 전화 오면 진동은 와요.', '화면이 지직거리다 가끔 안 나와요.'],
    visual: { need: 2, text: '디스플레이 커넥터가 소켓에서 한쪽이 살짝 들떠 있다.', basic: '커넥터가 약간 비뚤어져 보이는 것 같기도 하다…(확대경으로는 확신하기 어렵다)' } },
  batt_worn: { name: '배터리 노후(용량 저하)', slots: ['battery'], health: [58, 74],
    say: ['배터리가 너무 빨리 닳아요. 오후만 되면 꺼져요.', '20% 남았는데 갑자기 꺼져요.'],
    visual: { need: 1, text: '외관상 이상은 없다. 배터리 라벨의 제조일이 꽤 오래되었다.' } },
  batt_dead: { name: '배터리 완전 방전·셀 불량', slots: ['battery'], health: [2, 6],
    say: ['갑자기 전원이 안 켜져요.', '충전기를 꽂아야만 켜지고, 빼면 바로 꺼져요.'],
    visual: { need: 1, text: '외관상 큰 이상은 없다.' } },
  batt_swollen: { name: '배터리 팽창', slots: ['battery'], health: [55, 68], swollen: true,
    say: ['배터리가 빨리 닳고 뒷면이 살짝 떠 있어요.', '화면 쪽이 조금 들뜬 것 같고 배터리가 금방 닳아요.'],
    visual: { need: 1, text: '배터리 중앙이 눈에 띄게 부풀어 있다! (게임 속에서는 안전하게 분리 가능)' } },
  port_lint: { name: '충전 포트 이물질(먼지)', slots: ['charge_port'], eff: { charge: 'intermittent' }, cleanable: 'brush',
    say: ['충전이 잘 안 돼요. 충전기를 바꿔도 똑같아요.', '케이블을 꽂으면 헐거워서 충전이 됐다 안 됐다 해요.'],
    visual: { need: 1, text: '포트 안쪽에 주머니 먼지가 단단하게 뭉쳐 있다.', ext: true } },
  port_corroded: { name: '충전 포트 부식', slots: ['charge_port'], eff: { charge: 'intermittent' }, cleanable: 'ultrasonic', specks: true,
    say: ['충전이 잘 안 돼요. 충전기를 바꿔도 똑같아요.', '충전이 됐다 안 됐다 해요.'],
    visual: { need: 1, text: '포트 핀과 주변 부품에 초록·흰색 부식 가루가 보인다.', ext: true } },
  port_broken: { name: '충전 포트 단자 파손', slots: ['charge_port'], eff: { charge: 'none' },
    say: ['충전이 아예 안 돼요. 충전기를 바꿔도 똑같아요.', '충전기를 꽂아도 반응이 없어요.'],
    visual: { need: 2, text: '포트 내부 중앙 기판(텅)이 휘어 있다.', ext: true } },
  mic_dead: { name: '하단 마이크 고장', slots: ['microphone', 'charge_port'], eff: { mic: 'none' },
    say: ['통화할 때 상대방이 제 목소리가 안 들린대요.', '녹음하면 아무 소리도 안 들어가요.'],
    visual: { need: 2, text: '마이크 구멍의 방수 메시가 오염되어 있다.' } },
  board_pmic: { name: '전원 관리 회로(PMIC) 고장', slots: ['mainboard'], eff: { charge: 'none' }, pmic: true,
    say: ['갑자기 전원이 안 켜져요. 충전도 안 되는 것 같아요.', '아무 반응이 없어요. 충전기를 꽂아도 그래요.'],
    visual: { need: 2, text: '전원 관리 IC 주변에 미세하게 탄 자국이 있다.', chip: 'pmic' } },
  board_baseband: { name: '모뎀 회로 고장', slots: ['mainboard'], eff: { signal: 'none' }, modem: true,
    say: ['통화가 아예 안 되고 "서비스 없음"이 떠요.', '안테나가 아예 안 떠요.'],
    visual: { need: 2, text: '모뎀 부근 칩 아래에 미세한 부식 흔적.', chip: 'soc' } },
  cam_rear_dead: { name: '후면 카메라 모듈 불량', slots: ['camera_rear'], eff: { camera_rear: 'none' },
    say: ['카메라를 켜면 검은 화면만 나와요.', '카메라 앱이 안 열려요.'],
    visual: { need: 2, text: '카메라 모듈 플렉스 근처에 충격으로 눌린 자국.' } },
  cam_rear_blur: { name: '후면 카메라 초점/손떨림 보정 고장', slots: ['camera_rear'], eff: { camera_rear: 'blur' }, lens: true,
    say: ['사진이 흐릿하게 나와요. 초점이 안 잡혀요.', '카메라를 켜면 화면이 덜덜 떨리고 흐려요.'],
    visual: { need: 1, text: '렌즈 커버에 금이 가 있고, 모듈을 흔들면 내부에서 달그락 소리가 난다.' } },
  cam_front_dead: { name: '전면 카메라 불량', slots: ['camera_front'], eff: { camera_front: 'none' },
    say: ['셀카 모드로 바꾸면 검은 화면이에요.', '영상통화를 하면 제 얼굴이 안 나온대요.'],
    visual: { need: 2, text: '전면 카메라 렌즈 안쪽에 습기 자국이 있다.' } },
  spk_dead: { name: '라우드 스피커 무음', slots: ['speaker'], eff: { speaker: 'none' },
    say: ['음악을 틀어도 소리가 안 나요.', '벨소리가 안 울려요.'],
    visual: { need: 2, text: '스피커 그릴 안쪽에 물때 자국이 말라붙어 있다.' } },
  spk_blown: { name: '라우드 스피커 진동판 손상', slots: ['speaker'], eff: { speaker: 'distorted' },
    say: ['스피커 소리가 지직거리고 찢어져요.', '소리를 키우면 깨지는 소리가 나요.'],
    visual: { need: 2, text: '스피커 진동판이 찢어져 있다.' } },
  ear_dead: { name: '통화 스피커 고장', slots: ['earpiece'], eff: { earpiece: 'none' },
    say: ['통화할 때 상대방 목소리가 안 들려요. 스피커폰으로 하면 들려요.', '전화하면 아무 소리도 안 나요.'],
    visual: { need: 2, text: '통화 스피커 메시가 먼지와 유분으로 막혀 있고 코일이 끊어진 듯하다.' } },
  vib_dead: { name: '진동 모터 고장', slots: ['vibration'], eff: { vibration: 'none' },
    say: ['진동이 안 와요. 무음으로 해두면 전화를 다 놓쳐요.', '진동이 아예 안 돼요.'],
    visual: { need: 2, text: '진동 모터 내부 스프링이 부러진 듯 흔들면 소리가 난다.' } },
  btn_power: { name: '전원 버튼 고장', slots: ['button_flex'], eff: { buttons: 'power_fail' },
    say: ['갑자기 전원이 안 켜져요.', '전원 버튼을 눌러도 아무 반응이 없어요.'],
    visual: { need: 2, text: '전원 버튼 아래 돔 스위치가 찌그러져 있다.' } },
  btn_volume: { name: '음량 버튼 고장', slots: ['button_flex'], eff: { buttons: 'volume_fail' },
    say: ['볼륨 버튼이 안 눌려요.', '음량 버튼을 눌러도 소리가 안 바뀌어요.'],
    visual: { need: 2, text: '음량 버튼 돔 스위치 하나가 떨어져 있다.' } },
  ant_weak: { name: '안테나 손상', slots: ['antenna', 'midplate'], eff: { signal: 'weak' },
    say: ['통화가 자꾸 끊기고 안테나가 잘 안 떠요.', '집에서도 신호가 한 칸밖에 안 떠요.'],
    visual: { need: 2, text: '안테나 패턴 일부가 긁혀 끊어져 있다.' } },
  coil_dead: { name: '무선 충전 코일 단선', slots: ['coil'], eff: { wireless_charge: 'none' },
    say: ['무선 충전 패드에 올려도 충전이 안 돼요. 유선은 돼요.', '무선 충전이 안 돼요.'],
    visual: { need: 2, text: '코일 필름 한쪽이 접혀 구리선이 끊어져 있다.' } },
  flex_torn: { name: '메인 플렉스 케이블 손상', slots: ['flex_cable'], dead: true,
    say: ['충전도 안 되고 스피커 소리도 안 나요.', '충전이 안 되고 통화하면 제 목소리가 안 간대요.'],
    visual: { need: 1, text: '플렉스 케이블 중간이 접힌 채로 찢어져 있다.' } },
  sw_bootloop: { name: '소프트웨어 손상(부팅 반복)', software: true,
    say: ['로고만 뜨고 계속 꺼졌다 켜졌다 해요.', '업데이트하다가 전원이 안 켜져요. 로고만 떠요.'] },
  sw_touch: { name: '입력 드라이버 오류(소프트웨어)', software: true,
    say: ['터치가 제멋대로 눌려요.', '가만히 있어도 화면이 혼자 눌려요.'] },
  sw_drain: { name: '백그라운드 전력 과소모(소프트웨어)', software: true,
    say: ['배터리가 너무 빨리 닳아요. 오후만 되면 꺼져요.', '가만히 둬도 폰이 뜨겁고 배터리가 쭉쭉 닳아요.'] },
  /* 작업 중 발생하는 고장 */
  short: { name: '단락으로 인한 손상', dead: true, hidden: true },
  heat_damage: { name: '과열 손상', slots: ['display'], eff: { display: 'lines', touch: 'partial' }, hidden: true }
};

/* 의뢰 시나리오 — 원인(배경)과 고장 후보의 합리적 관계 */
const SCENARIOS = [
  { id: 'drop_screen', cause: 'drop', w: 3, pick: [['disp_lines', 6], ['disp_loose', 2], ['touch_dead', 1.5]], extra: [['cam_rear_blur', 0.22]] },
  { id: 'drop_black', cause: 'drop', w: 2, pick: [['disp_dead', 4], ['disp_loose', 3], ['lcd_backlight', 3]] },
  { id: 'charge', cause: 'age', w: 2.5, pick: [['port_lint', 3], ['port_corroded', 1.5], ['port_broken', 2], ['flex_torn', 1], ['board_pmic', 0.6]] },
  { id: 'battery', cause: 'age', w: 2.5, pick: [['batt_worn', 5], ['batt_swollen', 2], ['sw_drain', 2]] },
  { id: 'no_power', cause: 'sudden', w: 2, pick: [['batt_dead', 3], ['btn_power', 2], ['board_pmic', 1.5], ['sw_bootloop', 2]] },
  { id: 'water', cause: 'water', w: 1.5, multi: [['spk_dead', 3], ['port_corroded', 3], ['mic_dead', 2], ['ear_dead', 1.5], ['vib_dead', 1]], extra: [['board_baseband', 0.08]] },
  { id: 'call', cause: 'unknown', w: 2, pick: [['mic_dead', 3], ['ear_dead', 3], ['ant_weak', 1.2], ['board_baseband', 0.6]] },
  { id: 'camera', cause: 'drop', w: 1.5, pick: [['cam_rear_blur', 3], ['cam_rear_dead', 2], ['cam_front_dead', 1.5]] },
  { id: 'signal', cause: 'unknown', w: 1, pick: [['ant_weak', 3], ['board_baseband', 1.2]] },
  { id: 'touch', cause: 'unknown', w: 1.5, pick: [['touch_dead', 2], ['sw_touch', 3], ['disp_loose', 1]] },
  { id: 'sound', cause: 'unknown', w: 1.2, pick: [['spk_blown', 3], ['spk_dead', 2], ['flex_torn', 0.6]] },
  { id: 'misc', cause: 'unknown', w: 1, pick: [['btn_volume', 3], ['vib_dead', 2]] },
  { id: 'wireless', cause: 'unknown', w: 0.8, models: ['nova'], pick: [['coil_dead', 3]] }
];
const CAUSE_TEXT = {
  drop: { intro: ['어제 핸드폰을 떨어뜨렸는데요,', '계단에서 폰을 떨어뜨렸거든요.', '손에서 미끄러져서 바닥에 떨어졌어요.'], q: '네, 며칠 전에 바닥에 떨어뜨렸어요. 케이스도 없었고요.' },
  water: { intro: ['어제 폰이 물에 빠졌어요.', '비를 엄청 맞았는데 그 뒤로 이상해요.'], q: '네… 세면대에 빠뜨렸어요. 바로 꺼내서 말리긴 했어요.' },
  age: { intro: ['폰을 꽤 오래 썼는데요,', '요즘 들어서'], q: '아니요, 떨어뜨리거나 물에 젖은 적은 없어요. 그냥 오래 썼어요.' },
  sudden: { intro: ['어제까지 멀쩡했는데', '아침에 일어나 보니'], q: '아니요. 그런 일은 없었어요. 갑자기 이래요.' },
  unknown: { intro: ['언제부턴가', '얼마 전부터'], q: '글쎄요… 특별히 떨어뜨린 기억은 없어요.' }
};
const PERSONAS = [
  { id: 'student', label: '학생', budget: 0.85, patience: 1, talk: '반말 섞인 존댓말' },
  { id: 'office', label: '직장인', budget: 1.15, patience: 0, talk: '바쁨' },
  { id: 'owner', label: '자영업자', budget: 1.0, patience: 0, talk: '실용적' },
  { id: 'elder', label: '어르신', budget: 1.0, patience: 2, talk: '친절' },
  { id: 'univ', label: '대학생', budget: 0.9, patience: 1, talk: '' }
];
const NAMES = ['김민지', '이도윤', '박서연', '최준우', '정하은', '강지호', '조수아', '윤서준', '장예린', '임건우', '한소율', '오태민', '서지안', '신우진', '권나연', '황시우', '안채원', '송민재', '류다인', '전현우', '홍가은', '문지환', '배수빈', '노은호', '양시아', '구본혁', '남유나', '곽태윤'];

/* 부품 판매업체 */
const VENDORS = {
  cheap: { id: 'cheap', name: '싸다파츠', tag: '저가형', mult: 0.68, ship: 2500, days: [3, 5], defect: 0.15, grade: 'B', failLater: 0.12, color: '#e0703a', desc: '가격이 저렴하지만 배송이 느리고 품질 편차가 있음' },
  normal: { id: 'normal', name: '부품나라', tag: '일반', mult: 1.0, ship: 3000, days: [2, 3], defect: 0.04, grade: 'A', failLater: 0.03, color: '#3a8fe0', desc: '적당한 가격, 평균 배송, 비교적 안정적인 품질' },
  premium: { id: 'premium', name: '프로파츠', tag: '프리미엄', mult: 1.38, ship: 4000, days: [1, 2], defect: 0.01, grade: 'A+', failLater: 0.005, color: '#8a5ae0', express: 9000, desc: '높은 가격, 품질이 높고 당일 특급 배송 가능' }
};

/* 수리 도구 */
const TOOLS = {
  hand: { name: '손', icon: 'hand', desc: '부품을 집어 들고, 열고, 내려놓는다.', always: true },
  driver: { name: '정밀 드라이버', icon: 'driver', desc: '나사 위를 꾹 누르고 있으면 돌아가며 풀리거나 조여진다(짧게 누르면 안 돌아감). 나사 1개당 1분.', start: true },
  driver_e: { name: '전동 정밀 드라이버', icon: 'driver_e', price: 120000, desc: '부품을 클릭하면 그 부품의 나사를 한 번에 풀거나 조인다. 나사당 0.3분.', upgrades: 'driver' },
  spudger: { name: '플라스틱 스퍼저', icon: 'spudger', desc: '커넥터를 분리·연결한다. 정전기를 띠지 않는 플라스틱.', start: true, dur: 80 },
  pick: { name: '오프닝 픽 & 흡착컵', icon: 'pick', desc: '가열한 접착면을 잘라내거나 플라스틱 클립을 해제한다.', start: true, dur: 40 },
  heater: { name: '히팅 패드(기본)', icon: 'heater', desc: '접착제를 부드럽게 만드는 가상 가열 도구. 온도가 불안정하다.', start: true },
  heater_pro: { name: '정밀 히팅 스테이션', icon: 'heater', price: 180000, desc: '목표 온도를 자동 유지해 가열이 쉽고 빠르며 과열 위험이 낮다.', upgrades: 'heater' },
  tweezers: { name: '정밀 핀셋', icon: 'tweezers', desc: '작은 부품(전면 카메라, 마이크, 진동 모터 등)을 집는다.', start: true },
  magnifier: { name: '확대경', icon: 'magnifier', desc: '부품을 관찰해 외관 단서를 찾는다. 미세한 흔적은 놓칠 수 있다.', start: true },
  microscope: { name: '실체 현미경', icon: 'magnifier', price: 250000, desc: '커넥터 들뜸, 칩 주변 탄 자국 같은 미세 단서까지 확인.', upgrades: 'magnifier' },
  brush: { name: '정전기 방지 브러시', icon: 'brush', desc: '충전 포트 안의 먼지를 청소한다. (부식은 제거 불가)', start: true },
  tester: { name: 'USB 전류 측정기', icon: 'tester', desc: '진단 검사 결과를 대략적으로 보여준다.', start: true, passive: true },
  tester_pro: { name: '진단 보드 & 배터리 분석기', icon: 'tester', price: 220000, desc: '검사 결과를 수치로 보여주고, 배터리 건강도를 정확히 측정. 외부 전원으로 보드 단락 여부도 확인.', upgrades: 'tester', passive: true },
  ultrasonic: { name: '초음파 세척기', icon: 'ultrasonic', price: 300000, desc: '트레이에 분리한 충전 포트 모듈의 부식을 세척해 교체 없이 수리할 수 있다.', passive: true }
};
const TOOL_ORDER = ['hand', 'driver', 'spudger', 'pick', 'heater', 'tweezers', 'magnifier', 'brush'];

/* 매장 업그레이드 */
const UPGRADES = {
  sign: { name: 'LED 간판 교체', price: 400000, desc: '거리에서 눈에 잘 띄어 하루 손님이 평균 1명 늘어난다.' },
  sofa: { name: '고객 대기 소파', price: 200000, desc: '고객 만족도가 조금 오르고, 납기 지연에 대한 불만이 줄어든다.' },
  autoorder: { name: '자동 발주 시스템', price: 250000, desc: '재고관리에서 설정한 최소 수량 아래로 떨어진 부품을 영업 종료 시 일반 업체에 자동 주문한다.', req: { biz: 2 } },
  shelf: { name: '수리 대기 선반 확장', price: 150000, desc: '동시에 맡을 수 있는 수리 건수 4건 → 7건.' }
};

/* 기기 단계(해금) — 2단계 이후 콘텐츠는 아직 구현되지 않았음을 명시 */
const DEVICE_TIERS = [
  { lv: 1, devices: '스마트폰', implemented: true },
  { lv: 4, devices: '태블릿 · 무선 이어폰', implemented: false },
  { lv: 7, devices: '노트북 · 게임 컨트롤러', implemented: false },
  { lv: 10, devices: '휴대용 게임기 · 데스크톱 · 게임 콘솔', implemented: false },
  { lv: 13, devices: '스마트워치 · 디지털카메라 · 기타 소형 기기', implemented: false }
];

const SKILLS = {
  knowledge: { name: '스마트폰 지식', desc: 'Lv2: 작업대에서 커넥터 이름 표시 · Lv3: 선택한 부품과 연결된 커넥터 강조' },
  diag: { name: '진단 능력', desc: 'Lv2: 검사 결과 해석 힌트 · Lv3: 접수 시 원인 후보 추론' },
  assembly: { name: '조립 숙련도', desc: '가열·풀탭 미니게임 허용 범위 증가, 조립 시간 감소' },
  speed: { name: '작업 속도', desc: '레벨당 모든 작업 시간 5% 감소' },
  consult: { name: '고객 상담', desc: '고객이 받아들이는 견적 범위 증가 · Lv2: 예산 질문 정확도 향상' },
  parts: { name: '부품 관리', desc: '택배 개봉 시 초기 불량 발견 확률 증가, 배송비 할인' },
  biz: { name: '수리점 경영', desc: '주간 고정비 감소 · Lv2: 자동 발주 업그레이드 구매 가능' }
};
const RANKS = [[1, '수습 직원'], [3, '수리 기사'], [5, '선임 기사'], [8, '수석 기사'], [11, '점장 후보']];
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
