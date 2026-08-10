# SatSight

SvelteKit과 Capacitor로 만든 비트코인 전용 Watch Only Wallet입니다. 개인키나 시드 문구를 받지 않고, 비트코인 주소 또는 계정 단위 `xpub`/`tpub`만 기기 로컬에 저장합니다.

## 주요 기능

- SvelteKit `ssr = false` 기반 완전한 CSR 앱
- IndexedDB 기반 오프라인 우선 저장소
- Mainnet/Testnet 단일 주소 및 `xpub`/`tpub` 지갑
- 카메라 권한 기반 QR 가져오기(BIP21, 주소, xpub/tpub, descriptor)
- Legacy, Nested SegWit, Native SegWit, Taproot 주소 파생
- Esplora 호환 API를 통한 수동/선택적 자동 동기화
- PWA 서비스 워커 앱 셸 캐시
- Capacitor 8 Android/iOS 프로젝트와 Tauri 2 데스크톱 프로젝트
- 비밀키 입력, 서명, 전송 기능이 의도적으로 없는 Watch Only 경계

## Route

| Route                     | 역할                                            |
| ------------------------- | ----------------------------------------------- |
| `/`                       | 전체 잔액, 지갑, 최근 거래 대시보드             |
| `/wallets`                | 저장된 Watch Wallet 목록                        |
| `/wallets/new`            | 주소 또는 확장 공개키 가져오기                  |
| `/wallets/[id]`           | 지갑 잔액, 공개 정보, 동기화, 최근 거래         |
| `/wallets/[id]/addresses` | 외부/거스름 주소 목록                           |
| `/transactions`           | 전체 거래와 방향 필터                           |
| `/transactions/[id]`      | 거래 상세 및 탐색기 링크                        |
| `/settings`               | 표시 단위, Esplora 서버, 자동 동기화, gap limit |

동적 route는 정적 어댑터의 `index.html` fallback을 통해 CSR에서 해석됩니다.

## 오프라인 동작

첫 웹 방문 또는 설치 시 서비스 워커가 앱 셸과 route chunk를 캐시합니다. Capacitor 앱은 동일한 정적 빌드를 앱 내부에 번들합니다. 지갑, 파생 주소, 마지막 잔액과 거래는 IndexedDB에서 읽으므로 인터넷이 없어도 앱 탐색과 조회가 가능합니다.

네트워크가 필요한 작업은 Esplora 동기화뿐입니다. 동기화 실패 시 기존 로컬 스냅샷은 변경하지 않습니다. 기본 서버는 Blockstream Esplora이며 설정에서 직접 운영하는 Esplora URL로 변경할 수 있습니다.

> 확장 공개키와 주소도 금융 프라이버시 정보입니다. 동기화 서버는 조회한 주소들을 볼 수 있습니다. 높은 프라이버시가 필요하면 자신의 Esplora 서버를 사용하세요.

## 개발

Node.js 24 이상을 권장합니다. Android 네이티브 빌드에는 JDK 21 또는 24와 Android SDK가 필요합니다.

```sh
npm install
npm run dev
```

검증 명령:

```sh
npm test
npm run check
npm run lint
npm run build
```

## Capacitor

웹 빌드를 네이티브 프로젝트에 반영합니다.

```sh
npm run cap:sync
```

Android Studio 또는 Xcode에서 여는 명령:

```sh
npm run cap:android
npm run cap:ios
```

Android 프로젝트는 `android/`, iOS 프로젝트는 `ios/`에 있습니다. 앱 식별자는 `io.axoneo.satsight`입니다.

## Tauri 데스크톱

개발 창을 실행합니다.

```sh
npm run tauri:dev
```

현재 운영체제용 설치 패키지를 생성합니다.

```sh
npm run tauri:build
```

Tauri 프로젝트는 `src-tauri/`에 있으며 Windows, macOS, Linux 번들 설정을 포함합니다. 외부 블록 탐색기 링크는 최소 권한의 opener 플러그인으로 시스템 브라우저에서 엽니다. 플랫폼별 패키징에는 해당 운영체제의 Tauri 시스템 의존성이 필요합니다.

## 보안 경계

- `xprv`, WIF 개인키, 시드 문구를 지원하지 않습니다.
- 트랜잭션 생성·서명·브로드캐스트 기능이 없습니다.
- 지갑 데이터는 별도 클라우드 계정 없이 현재 기기의 IndexedDB에만 저장됩니다.
- 이 앱은 잔액을 관찰하는 도구이며 백업 수단이 아닙니다. 원본 지갑의 시드 백업은 별도로 안전하게 보관해야 합니다.
