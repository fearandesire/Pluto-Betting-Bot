# Changelog

## [4.3.0](https://github.com/fearandesire/Pluto-Betting-Bot/compare/v4.2.0...v4.3.0) (2026-01-28)


### Features

* add timezone support to odds command and update dependencies ([#370](https://github.com/fearandesire/Pluto-Betting-Bot/issues/370)) ([3716406](https://github.com/fearandesire/Pluto-Betting-Bot/commit/3716406363950bcc5e513f4882469e50cd0aa199))
* **ci:** add workflow to sync Khronos Swagger spec and regenerate OpenAPI client ([7f14adb](https://github.com/fearandesire/Pluto-Betting-Bot/commit/7f14adb36e0b414ff0a9b655c5ad948d1835b832))
* **ci:** Upgrade CI/CD pipeline with enhanced versioning and deployment controls ([#345](https://github.com/fearandesire/Pluto-Betting-Bot/issues/345)) ([295a26d](https://github.com/fearandesire/Pluto-Betting-Bot/commit/295a26dc67b9856314df27604fecb94d10955ad7))


### Bug Fixes

* **ci:** track swagger spec and generate OpenAPI client in CI ([f2c493f](https://github.com/fearandesire/Pluto-Betting-Bot/commit/f2c493fae9384d613f6053b96ed697e964353a2e))
* **ci:** update Khronos spec fetching to use authorization token ([c2f006b](https://github.com/fearandesire/Pluto-Betting-Bot/commit/c2f006b2b8c185c05364f99c4a7a460180405615))
* standardize package names in pnpm-lock.yaml and update lodash version to 4.17.23 ([b40a265](https://github.com/fearandesire/Pluto-Betting-Bot/commit/b40a265102b74866a225327ebfe883674fe0950f))
* update release-please config and remove timezone from odds display ([4d6a1a2](https://github.com/fearandesire/Pluto-Betting-Bot/commit/4d6a1a2b179caa0b7e02db6da9695b35bb7e01d2))

## [4.2.0](https://github.com/fearandesire/Pluto-Betting-Bot/compare/v4.1.0...v4.2.0) (2026-01-20)


### Features

* add config command for footer management and context-aware bet footers ([c827d77](https://github.com/fearandesire/Pluto-Betting-Bot/commit/c827d77bcc508f1526681102c65ddc08e07769ee))
* add config command for footer management and context-aware bet footers ([#313](https://github.com/fearandesire/Pluto-Betting-Bot/issues/313)) ([1561c5d](https://github.com/fearandesire/Pluto-Betting-Bot/commit/1561c5d6fa7cadf725905cecfe9793bbde2b3c1f))
* Add pagination to /mybets command with retry logic improvements ([#268](https://github.com/fearandesire/Pluto-Betting-Bot/issues/268)) ([732426c](https://github.com/fearandesire/Pluto-Betting-Bot/commit/732426c3db4f8f18c3d82a48e8c7d40cd306394b))


### Bug Fixes

* **footers:** resolve type error in category access ([38ba99e](https://github.com/fearandesire/Pluto-Betting-Bot/commit/38ba99eb56c4b739593f85e359de39358cbabfc0))
* method reference ([f5b80b4](https://github.com/fearandesire/Pluto-Betting-Bot/commit/f5b80b47ff99964abc205bfae4b3ee67798b6b02))
* update environment variable validation ([#312](https://github.com/fearandesire/Pluto-Betting-Bot/issues/312)) ([957b00f](https://github.com/fearandesire/Pluto-Betting-Bot/commit/957b00fe2b9a10e092903f9a648ca53fd70c30fd))
* update leaderboard API to v1 endpoint ([#304](https://github.com/fearandesire/Pluto-Betting-Bot/issues/304)) ([7a8bb82](https://github.com/fearandesire/Pluto-Betting-Bot/commit/7a8bb8269d003761c5b1eb3963f7394e6ad8ee0a))

## [4.1.0](https://github.com/fearandesire/Pluto-Betting-Bot/compare/v4.0.0...v4.1.0) (2025-12-02)


### Features

* **api:** add Khronos API service layer and error definitions ([49573c2](https://github.com/fearandesire/Pluto-Betting-Bot/commit/49573c2d051be7df171a1db6a8ef249a1a6d473f))
* **bot:** initialize FooterManager on ready event ([d1bd2eb](https://github.com/fearandesire/Pluto-Betting-Bot/commit/d1bd2ebe84cabff8beca909da9001aef3f94611f))
* **changelog:** add explicit command name property ([f1edbb7](https://github.com/fearandesire/Pluto-Betting-Bot/commit/f1edbb78abe7fa2da202949513f9a93a72a4e039))
* **footers:** implement centralized FooterManager with remote config ([bf34345](https://github.com/fearandesire/Pluto-Betting-Bot/commit/bf343453ced9fc9aeaf02af7b4efa6ddd06d2a26))

## 4.0.0 (2025-12-01)


### ⚠ BREAKING CHANGES

* release-please integration and changelog viewer

### Features

* Add @pluto-khronos/types and update dependencies ([db5a28a](https://github.com/fearandesire/Pluto-Betting-Bot/commit/db5a28a33b6bc76f0e585a8675ca24a0b6d8f737))
* add admin command to clear game channels and update constants ([477f3ec](https://github.com/fearandesire/Pluto-Betting-Bot/commit/477f3ec0daf6cf531fecaea8764e1b06666c164c))
* Add API key authentication middleware ([8791f2b](https://github.com/fearandesire/Pluto-Betting-Bot/commit/8791f2b6030a08cfe757c10de629b5a7d596a584))
* add betting stats command with comprehensive user statistics ([6ac4f82](https://github.com/fearandesire/Pluto-Betting-Bot/commit/6ac4f82a66086a86fa97402f27012755299e10ad))
* add eligibleMatches to scheduled channels configuration ([fa9ce4e](https://github.com/fearandesire/Pluto-Betting-Bot/commit/fa9ce4ecbcef9dcf95e24fb5d391061d9fce3d09))
* add endpoint to retrieve prop by UUID ([9b7a682](https://github.com/fearandesire/Pluto-Betting-Bot/commit/9b7a682008aa46a19640832979bd38a9f0b7c6c1))
* add logging for channel creation request ([40aef4e](https://github.com/fearandesire/Pluto-Betting-Bot/commit/40aef4eb4c721782918e620612e3e492568441f6))
* add maintenance mode handling to account and betting commands ([59eeff2](https://github.com/fearandesire/Pluto-Betting-Bot/commit/59eeff28b8af95cc31c267783d7ddd2a1b5d5463))
* add new API endpoints for random props and result setting ([9bcd60c](https://github.com/fearandesire/Pluto-Betting-Bot/commit/9bcd60c54aa27ff2e331e0081a57e89bead4c433))
* Add Redis PubSub infrastructure for event-driven communication ([7f14a4a](https://github.com/fearandesire/Pluto-Betting-Bot/commit/7f14a4aac25fc08ef8df36514d0872f8dc605b64))
* admin mgmt; api updates with tie support ([#201](https://github.com/fearandesire/Pluto-Betting-Bot/issues/201)) ([de46566](https://github.com/fearandesire/Pluto-Betting-Bot/commit/de46566f0880ee58e749ad9442d5bca08b3cf5d1))
* **admin:** introduce admin commands for managing predictions and props ([#191](https://github.com/fearandesire/Pluto-Betting-Bot/issues/191)) ([692d56e](https://github.com/fearandesire/Pluto-Betting-Bot/commit/692d56e769be2e7f5ab9a14bddeb60a8575a8835))
* **api:** add new prediction endpoints and enhance prop descriptions ([fabe2ef](https://github.com/fearandesire/Pluto-Betting-Bot/commit/fabe2ef93ae7416614e8a42f854017037e6d9365))
* bullmq, queue system; file tree organization, renamings ([382ba9c](https://github.com/fearandesire/Pluto-Betting-Bot/commit/382ba9c061f8781067012883f1faf3dc4d5da0ce))
* enhance API documentation and add random props functionality ([32acecf](https://github.com/fearandesire/Pluto-Betting-Bot/commit/32acecfd7128df8f5e32feaefbbeed97070a2790))
* enhance betting stats display with total wins, losses, and monetary formatting ([675629a](https://github.com/fearandesire/Pluto-Betting-Bot/commit/675629ad2747acc4704f335ab0a444d54f2a74b9))
* enhance project configuration and logging setup ([71e6ebd](https://github.com/fearandesire/Pluto-Betting-Bot/commit/71e6ebd6e2af00ce061f9bfbb4fbb7ffae534e54))
* enhance PropPostingHandler to support dynamic odds and outcome buttons ([c7a56e0](https://github.com/fearandesire/Pluto-Betting-Bot/commit/c7a56e0b46734e42760e10fba55590644e1ee604))
* enhance PropPostingHandler with team data resolution and embed improvements ([fb03eb5](https://github.com/fearandesire/Pluto-Betting-Bot/commit/fb03eb58ca070ecd2facb5736197ef4e242c0084))
* Enhance user onboarding, predictions, and props system with improved caching and error handling ([#230](https://github.com/fearandesire/Pluto-Betting-Bot/issues/230)) ([f3fcc84](https://github.com/fearandesire/Pluto-Betting-Bot/commit/f3fcc843a76bc308b441ee52220c57d62b65267b))
* implement active predictions retrieval in props command ([36a4455](https://github.com/fearandesire/Pluto-Betting-Bot/commit/36a445560c9635f4699d0ca7c3ae8e63a95d9b1b))
* Implement BullMQ for channel creation queue processing ([a19fc7a](https://github.com/fearandesire/Pluto-Betting-Bot/commit/a19fc7a701df7bb563e5ce5dae008efe796ba4d2))
* implement prop posting handler and enhance props command functionality ([20ccbc0](https://github.com/fearandesire/Pluto-Betting-Bot/commit/20ccbc01db0b6566e56593e5cd919ce3a9ef3d6a))
* integrate maintenance mode check in betting command ([fc4649b](https://github.com/fearandesire/Pluto-Betting-Bot/commit/fc4649b84e982881f3afd1c8349bad87042d76c5))
* **interaction:** add timeout for error message deletion in ButtonHandler ([2a69173](https://github.com/fearandesire/Pluto-Betting-Bot/commit/2a691737694add3cf46b876a04e56c2eded198ab))
* **logging:** enhance Winston logging setup with new transports and formats ([ed10433](https://github.com/fearandesire/Pluto-Betting-Bot/commit/ed10433702dd2f04721f176bc6319b4e20fb3eaf))
* **odds:** enhance odds formatting with guild-specific customizations ([5a15147](https://github.com/fearandesire/Pluto-Betting-Bot/commit/5a151471a8c3f4f6e95fe123b153917240aff9c4))
* **props:** enhance player prop handling and posting logic ([9e9e7a9](https://github.com/fearandesire/Pluto-Betting-Bot/commit/9e9e7a9c81bf97a5b824978b81ab0717964e4804))
* **props:** implement active props caching and autocomplete functionality ([48d7f2c](https://github.com/fearandesire/Pluto-Betting-Bot/commit/48d7f2c2beaaba8e635057106019e2a9c749e2eb))
* **props:** update embed formatting and title in PropPostingHandler ([8331bef](https://github.com/fearandesire/Pluto-Betting-Bot/commit/8331befc7c159ffa7dc37a21da385844517366ca))
* release-please integration and changelog viewer ([606377d](https://github.com/fearandesire/Pluto-Betting-Bot/commit/606377d6534fbac708090b358eb0c03597fa6b9b))
* update Docker configuration and environment handling ([44ccfb1](https://github.com/fearandesire/Pluto-Betting-Bot/commit/44ccfb1d215ab847aee89ed904f04f93c5b2587a))
* update swagger ([312b938](https://github.com/fearandesire/Pluto-Betting-Bot/commit/312b938514da0905fac4791b18cd4ea7ce2837e8))
* update Swagger spec and TypeScript configuration ([e3d1f36](https://github.com/fearandesire/Pluto-Betting-Bot/commit/e3d1f369efe5d42fb3748269cd2dd9ec33f330fd))


### Bug Fixes

* **Dockerfile:** Update production dependency installation to skip scripts, avoiding husky prepare hook ([889e92d](https://github.com/fearandesire/Pluto-Betting-Bot/commit/889e92d3fc50657118e2a6bbad313caea57fe234))
* Improve error handling in channel creation queue ([5e0ef9b](https://github.com/fearandesire/Pluto-Betting-Bot/commit/5e0ef9b250ae9c9072e8a30a77021e1bc5476f0d))
* rm 'automerge' label attempt ([f6b36b5](https://github.com/fearandesire/Pluto-Betting-Bot/commit/f6b36b55bdd364277eae221cca68da9bdfd6f543))
* skip processing for complete matches in odds preparation ([d90ca85](https://github.com/fearandesire/Pluto-Betting-Bot/commit/d90ca85a96372c15d2394a5a423d85e0d7855722))
* typo in env var ([108cf12](https://github.com/fearandesire/Pluto-Betting-Bot/commit/108cf12b44cd16426e0a3dc35b3744055eb4472f))
* update admin route path in authentication and logging middleware ([10e0b8d](https://github.com/fearandesire/Pluto-Betting-Bot/commit/10e0b8d34c508c126e9423926535a24f9f8ff58a))
* update Bull Board route path to match API convention ([af5d50c](https://github.com/fearandesire/Pluto-Betting-Bot/commit/af5d50cd76ac37a46d8e36a3fd6911827b435d83))
* update embed title formatting in PropPostingHandler for improved clarity ([618d771](https://github.com/fearandesire/Pluto-Betting-Bot/commit/618d7711bfb8954318625d78e7214b3043ea8019))
* update environment variable references for consistency ([9229be2](https://github.com/fearandesire/Pluto-Betting-Bot/commit/9229be2181f4a305f2ee1b3fb28efe160edc3d55))
* update LOG_LEVEL to use environment variable or default to "Info" ([fce6170](https://github.com/fearandesire/Pluto-Betting-Bot/commit/fce617037b1f007834edc7e0e52a4a1ac5d86adc))


### Miscellaneous Chores

* release 4.0.0 ([05711e1](https://github.com/fearandesire/Pluto-Betting-Bot/commit/05711e1a9a9ca7805585a7c2ab45df62525eed4f))

## v3.5.1

[compare changes](https://github.com/fearandesire/Pluto-Betting-Bot/compare/v3.5.0...v3.5.1)

### 🩹 Fixes

- Rm 'automerge' label attempt ([f6b36b5](https://github.com/fearandesire/Pluto-Betting-Bot/commit/f6b36b5))

### 💅 Refactors

- Added & improved footer generation; adjusted config, dependencies ([9dbfdc2](https://github.com/fearandesire/Pluto-Betting-Bot/commit/9dbfdc2))

### 🏡 Chore

- Configure release and dependabot settings ([443b676](https://github.com/fearandesire/Pluto-Betting-Bot/commit/443b676))
- Dependabot direct config ([79e11a6](https://github.com/fearandesire/Pluto-Betting-Bot/commit/79e11a6))
- Dependabot config ([a10b4ce](https://github.com/fearandesire/Pluto-Betting-Bot/commit/a10b4ce))
- **deps-dev:** Bump typescript from 5.6.2 to 5.7.3 ([#49](https://github.com/fearandesire/Pluto-Betting-Bot/pull/49))
- Add GitHub workflow for auto-merging Dependabot PRs ([13c7ee4](https://github.com/fearandesire/Pluto-Betting-Bot/commit/13c7ee4))
- Update Dependabot auto-merge workflow configuration ([4fb1042](https://github.com/fearandesire/Pluto-Betting-Bot/commit/4fb1042))
- **deps-dev:** Bump @biomejs/biome from 1.9.2 to 1.9.4 ([#43](https://github.com/fearandesire/Pluto-Betting-Bot/pull/43))
- **deps-dev:** Bump eslint-plugin-import from 2.29.1 to 2.31.0 ([e23395d](https://github.com/fearandesire/Pluto-Betting-Bot/commit/e23395d))
- **deps-dev:** Bump prettier-eslint-cli from 7.1.0 to 8.0.1 ([d7e3cf6](https://github.com/fearandesire/Pluto-Betting-Bot/commit/d7e3cf6))
- **deps-dev:** Bump @types/lodash from 4.17.7 to 4.17.15 ([653788f](https://github.com/fearandesire/Pluto-Betting-Bot/commit/653788f))
- **deps-dev:** Bump @biomejs/cli-win32-x64 from 1.9.2 to 1.9.4 ([f9ce2be](https://github.com/fearandesire/Pluto-Betting-Bot/commit/f9ce2be))
- **deps-dev:** Bump rimraf from 5.0.10 to 6.0.1 ([8f20d30](https://github.com/fearandesire/Pluto-Betting-Bot/commit/8f20d30))
- **deps-dev:** Bump rimraf from 5.0.10 to 6.0.1 ([#62](https://github.com/fearandesire/Pluto-Betting-Bot/pull/62))
- **deps-dev:** Bump vite in the npm_and_yarn group across 1 directory ([#53](https://github.com/fearandesire/Pluto-Betting-Bot/pull/53))
- **deps-dev:** Bump @types/color from 3.0.6 to 4.2.0 ([1ed15b4](https://github.com/fearandesire/Pluto-Betting-Bot/commit/1ed15b4))
- **deps-dev:** Bump @types/color from 3.0.6 to 4.2.0 ([#66](https://github.com/fearandesire/Pluto-Betting-Bot/pull/66))
- **deps-dev:** Bump eslint-plugin-prettier from 5.2.1 to 5.2.3 ([adedbd0](https://github.com/fearandesire/Pluto-Betting-Bot/commit/adedbd0))
- **deps-dev:** Bump eslint-plugin-prettier from 5.2.1 to 5.2.3 ([#69](https://github.com/fearandesire/Pluto-Betting-Bot/pull/69))
- **deps-dev:** Bump @types/ws from 8.5.12 to 8.5.14 ([78e4255](https://github.com/fearandesire/Pluto-Betting-Bot/commit/78e4255))
- **deps-dev:** Bump @types/ws from 8.5.12 to 8.5.14 ([#72](https://github.com/fearandesire/Pluto-Betting-Bot/pull/72))
- **deps-dev:** Bump @types/jest from 29.5.12 to 29.5.14 ([efa17b0](https://github.com/fearandesire/Pluto-Betting-Bot/commit/efa17b0))
- **deps-dev:** Bump @types/jest from 29.5.12 to 29.5.14 ([#74](https://github.com/fearandesire/Pluto-Betting-Bot/pull/74))

### 🤖 CI

- Change name of dep bot action ([8762c5e](https://github.com/fearandesire/Pluto-Betting-Bot/commit/8762c5e))
- Update dependabot config ([c1003f8](https://github.com/fearandesire/Pluto-Betting-Bot/commit/c1003f8))

### ❤️ Contributors

- Fearandesire <fenixcoding@gmail.com>
- FENIX ([@fearandesire](http://github.com/fearandesire))

## v3.5.0

[compare changes](https://github.com/fearandesire/Pluto-Betting-Bot/compare/v3.1.11...v3.5.0)

> [!NOTE]
> I haven't put out a release in a while, so this changelog includes a summary of all the changes I've made since v3.1.11. Some things are not included, some happened a while ago, and some are just new.

### 🚀 Enhancements

- Added comprehensive prop betting system
- Implemented new prop leaderboard system with multiple viewing options
- Added H2H betting stats command with user statistics - (`/stats`)
- Enhanced API error handling and logging with Winston
- Added varying footer text for embeds for fun
- Added support for NBA and NFL prop betting
- Integrated Zod for schema validation and improved type safety

### 🩹 Fixes

- Improved date handling and comparisons
- Fixed prediction choice restoration
- Enhanced error handling for API responses
- Resolved issues with leaderboard parsing
- Fixed guild configuration handling

### 💅 Refactors

- Migrated to pnpm package manager
- Improved prop selection and embed generation
- Enhanced error handling across the application
- Simplified API integration and response handling
- Improved command structure and organization

### 📖 Documentation

- Improved & Added JSDoc documentation across the codebase
- Enhanced method and module documentation
- Improved API documentation and type definitions

### 🏡 Chore

- Updated TypeScript configuration
- Enhanced development environment setup
- Improved dependency management
- Added OpenAPI specification

### 🎨 Styles

- Enhanced leaderboard formatting
- Improved betting statistics display
- Enhanced prop betting UI/UX
- Improved active props display
- Added clearer betting instructions

### ❤️ Contributors

- Fenix ([@fearandesire](http://github.com/fearandesire))

## v3.1.11

[compare changes](https://github.com/fearandesire/Pluto-Betting-Bot/compare/v3.1.10...v3.1.11)

### 🏡 Chore

- Update changelog ([1610bb8](https://github.com/fearandesire/Pluto-Betting-Bot/commit/1610bb8))
- Pkg Script for CI ([ab55d32](https://github.com/fearandesire/Pluto-Betting-Bot/commit/ab55d32))

### ❤️ Contributors

- Fearandesire ([@fearandesire](http://github.com/fearandesire))

## v3.1.10

[compare changes](https://github.com/fearandesire/Pluto-Betting-Bot/compare/v.3.1.7...v3.1.10)

### 🩹 Fixes

- Fallback for headline ([7fca16e](https://github.com/fearandesire/Pluto-Betting-Bot/commit/7fca16e))
- Fallback for headline ([d483e71](https://github.com/fearandesire/Pluto-Betting-Bot/commit/d483e71))

### 💅 Refactors

- Style amounts in USD; Strict typing on Money Format ([b8957ea](https://github.com/fearandesire/Pluto-Betting-Bot/commit/b8957ea))
- Improve `/help` wording; Adjust footers; Rm /about ([d49a27d](https://github.com/fearandesire/Pluto-Betting-Bot/commit/d49a27d))
- Add `dailyclaim` desc; Improve wording ([3941901](https://github.com/fearandesire/Pluto-Betting-Bot/commit/3941901))
- Rm footer ([bac41fd](https://github.com/fearandesire/Pluto-Betting-Bot/commit/bac41fd))
- Adjust colors, docs, README ([4313fa1](https://github.com/fearandesire/Pluto-Betting-Bot/commit/4313fa1))
- Style amount; Defer reply for the future ([5625857](https://github.com/fearandesire/Pluto-Betting-Bot/commit/5625857))
- Docs for Khronos API module; Use new API auth header ([c1a29d3](https://github.com/fearandesire/Pluto-Betting-Bot/commit/c1a29d3))

### 🏡 Chore

- Documentation for Pluto API ([fa75e65](https://github.com/fearandesire/Pluto-Betting-Bot/commit/fa75e65))
- Update vault ([5826813](https://github.com/fearandesire/Pluto-Betting-Bot/commit/5826813))
- Set git attributes in pkg.json ([11b0336](https://github.com/fearandesire/Pluto-Betting-Bot/commit/11b0336))

### 🎨 Styles

- Fix italic ([11879ab](https://github.com/fearandesire/Pluto-Betting-Bot/commit/11879ab))
- Wrapping for hyperlink ([cbfcff1](https://github.com/fearandesire/Pluto-Betting-Bot/commit/cbfcff1))
- Remove colon, add newline to end ([3f3a4d8](https://github.com/fearandesire/Pluto-Betting-Bot/commit/3f3a4d8))

### ❤️ Contributors

- Fearandesire ([@fearandesire](http://github.com/fearandesire))
