/* ===== 랭킹 이름 비속어 거르기 =====
   웹게임에서 순위표에 이름(별명)을 올릴 때 욕설·비속어가 들어 있으면 막아요.
   - Badwords.has(이름)  : 비속어가 들어 있으면 true
   - Badwords.mask(이름) : 비속어가 든 이름이면 가린 이름("고운말친구")을, 아니면 그대로 돌려줘요
   - Badwords.MESSAGE    : 막았을 때 보여 줄 안내 문구

   거르는 방법
   1) 띄어쓰기·숫자·기호를 지우고 비교해요.   (예: "시 1 발", "씨-발")
   2) 따로 친 자음·모음은 글자로 합쳐서도 비교해요. (예: "ㅅㅣ발", "시ㅂㅏㄹ")
   3) 초성 줄임말을 따로 비교해요.             (예: "ㅅㅂ", "ㅂㅅ")
   4) 영어 욕설과 한/영 전환을 깜빡하고 친 욕설도 비교해요. (예: "tlqkf" = 시발)
   새로 막고 싶은 말이 생기면 아래 목록에 더해 주세요. */
(function(){
  /* 한글 비속어 (띄어쓰기 없이) */
  var WORDS = [
    // 시발 계열
    "시발","씨발","씌발","쉬발","쓰발","슈발","시벌","씨벌","시빨","씨빨","시팔","씨팔","씨펄","시펄","씨바","시바","씨바알",
    "십알","씹알","십새","씹새","씹","씨부랄","씨부럴","씨불","시부랄","ㅆ발","ㅅ발","시ㅂ","씨ㅂ",
    // 좆·존나 계열
    "좆","좃같","좆같","좃까","조까","좆까","존나","존니","졸라","졸래","존내",
    // 병신·미친 계열
    "병신","븅신","빙신","병싄","뷩신","등신","미친놈","미친년","미친새","미친것","미친","미췬","미틴","또라이","돌아이","똘아이","찐따","정신병자",
    // 새끼·개 계열
    "새끼","새기","색기","섹기","쌔끼","쌔기","새퀴","쉐끼","쉑끼","개새","개색","개쉑","개쌔","개같","개년","개놈","개자식","개소리","개씹",
    "쌍놈","쌍년","썅","상놈","잡놈","잡년","화냥","후레자식",
    // 지랄·꺼져 계열
    "지랄","즤랄","찌랄","염병","엠병","옘병","닥쳐","닥치","꺼져","꺼지라","엿먹","엿이나","뒤져","뒈져","디져","뒤지라","죽어라","죽일","죽여","자살",
    // 부모 욕
    "니미","니애미","니엄마","느금","느개비","니애비","애미","애비","엄창","패드립","니아비",
    // 성적인 말
    "섹스","쎅스","야동","자지","보지","잠지","꼬추","딸딸이","강간","성폭행","창녀","창놈","걸레년",
    // 비하 표현
    "한남충","김치녀","된장녀","틀딱","급식충","맘충","장애새","흑형","깜둥"
  ];

  /* 초성·자음 줄임말 (그대로 친 자음만 비교해요) */
  var JAMO = [
    "ㅅㅂ","ㅆㅂ","ㅄ","ㅂㅅ","ㅈㄹ","ㅈㄴ","ㅁㅊ","ㄱㅅㄲ","ㅅㄲ","ㅆㄹㄱ","ㄲㅈ","ㄷㅊ","ㅗ","ㅈ같","ㅅㅍ","ㅆㅍ","ㅂㄹ","ㅇㅁ","ㄴㄱㅁ"
  ];

  /* 영어 욕설 + 한/영 전환을 잊고 친 한글 욕설 */
  var LATIN = [
    "fuck","fuk","fck","fxck","phuck","shit","sh1t","bitch","biatch","asshole","bastard","dick","pussy","cunt","whore","slut",
    "porn","sex","nigger","nigga","retard","motherf","wtf","stfu","kys",
    "tlqkf","tlvkf","tlqk","qudtls","wlfkf","whssk","whffk","wht","whw","alcls","rotorl","torl","ekrcu","rjwu","dutajr","duaqud","tprtm"
  ];

  /* 괜찮은 말인데 위 목록에 걸리는 경우 (먼저 지우고 비교해요) */
  var ALLOW = [
    "새끼손가락","새끼발가락","새끼고양이","새끼강아지","새끼곰","새끼오리","새끼새","새끼돼지","새끼토끼","새끼사자","새끼호랑이",
    "시바견","시바이누","미친듯이","보지마","보지말","자지마","자지말","졸라맨"
  ];

  var CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  var JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
  var JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

  /* 소문자로 바꾸고 한글·영어만 남겨요 (띄어쓰기·숫자·기호 지우기) */
  function squash(s){
    s = String(s == null ? "" : s);
    if(s.normalize) s = s.normalize("NFC");
    return s.toLowerCase().replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z]/g, "");
  }

  /* 따로 친 자음·모음을 글자로 합쳐요 : "ㅅㅣ바ㄹ" → "시발" */
  function compose(s){
    var out = [];
    for(var i = 0; i < s.length; i++){
      var ch = s.charAt(i), nx = s.charAt(i + 1);
      var cho = CHO.indexOf(ch), jung = JUNG.indexOf(nx);
      if(cho !== -1 && jung !== -1){               // 자음 + 모음 → 새 글자
        out.push(String.fromCharCode(0xAC00 + cho * 588 + jung * 28));
        i++;
        continue;
      }
      var jong = JONG.indexOf(ch);
      var prev = out.length ? out[out.length - 1].charCodeAt(0) - 0xAC00 : -1;
      if(jong > 0 && prev >= 0 && prev <= 11171 && prev % 28 === 0 && JUNG.indexOf(nx) === -1){
        out[out.length - 1] = String.fromCharCode(0xAC00 + prev + jong);   // 받침 없는 글자 + 자음 → 받침
        continue;
      }
      out.push(ch);
    }
    return out.join("");
  }

  function stripAllowed(s){
    for(var i = 0; i < ALLOW.length; i++){
      var a = squash(ALLOW[i]);
      while(s.indexOf(a) !== -1) s = s.replace(a, "");
    }
    return s;
  }

  var WORDS_SQ = WORDS.map(squash);
  var LATIN_LOWER = LATIN.map(function(w){ return w.toLowerCase(); });

  function has(text){
    var s = stripAllowed(squash(text));
    if(!s) return false;
    var i;
    for(i = 0; i < LATIN_LOWER.length; i++) if(s.indexOf(LATIN_LOWER[i]) !== -1) return true;
    for(i = 0; i < JAMO.length; i++) if(s.indexOf(JAMO[i]) !== -1) return true;
    var c = stripAllowed(compose(s));
    for(i = 0; i < WORDS_SQ.length; i++){
      if(s.indexOf(WORDS_SQ[i]) !== -1 || c.indexOf(WORDS_SQ[i]) !== -1) return true;
    }
    return false;
  }

  function mask(name){
    return has(name) ? "고운말친구" : name;
  }

  window.Badwords = {
    has: has,
    mask: mask,
    MESSAGE: "바르고 고운 말로 이름을 지어 주세요! 욕설이나 나쁜 말은 순위표에 올릴 수 없어요."
  };
})();
