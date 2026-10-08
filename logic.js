/* 핵심 로직: 프로그램 실제 소스에서 발췌한 코드와 설명 */
window.LOGIC = {
 "rap/0": [
  {
   "h": "자재번호 자동 채번 <code>setMatnr</code> (on save)",
   "d": "자재유형을 접두어로, 같은 자재유형의 최대 자재번호를 <code>zi_a20_mara</code>에서 조회해 숫자부 + 1. 전체 10자리가 되도록 숫자부를 0으로 채움 (예: VERP000001, FERT000001)",
   "lang": "abap",
   "src": "LOOP AT materials INTO DATA(material).\n  IF material-Matnr IS NOT INITIAL\n     OR material-Mtart IS INITIAL.\n    CONTINUE.\n  ENDIF.\n  DATA(prefix) = CONV string( material-Mtart ).\n  \" MATNR 전체 길이 10자리\n  DATA(number_length) = 10 - strlen( prefix ).\n  \" 해당 자재유형으로 시작하는 마지막 MATNR 조회\n  SELECT MAX( matnr )\n    FROM zi_a20_mara\n    WHERE Mtart = @material-Mtart\n    INTO @DATA(max_matnr).\n  DATA next_number TYPE i VALUE 1.\n  IF max_matnr IS NOT INITIAL.\n    DATA(max_matnr_string) = CONV string( max_matnr ).\n    DATA(number_part) =\n      substring(\n        val = max_matnr_string\n        off = strlen( prefix ) ).\n    next_number = CONV i( number_part ) + 1.\n  ENDIF.\n  \" 숫자부 0 Padding\n  DATA(number_string) = |{ next_number WIDTH = number_length PAD = '0' ALIGN = RIGHT }|.\n  DATA(new_matnr) = |{ prefix }{ number_string }|.\n  MODIFY ENTITIES OF zr_a20_mara IN LOCAL MODE\n    ENTITY Material\n      UPDATE FIELDS ( Matnr )\n      WITH VALUE #(\n        (\n          %tky  = material-%tky\n          Matnr = new_matnr\n        )\n      ).\nENDLOOP.",
   "cap": "ZBP_R_A20_MARA"
  },
  {
   "h": "생성 기본값 <code>setDefaultControl</code> (on modify)",
   "d": "생성 시 비어 있는 필드에만 기본값 적용: 가격관리지시자 S, 통화 <code>zcl_a20_waers=>c_waers</code>(KRW), 가격단위 1, 기본단위 EA, 등록일 시스템일자. 이미 모두 채워져 있으면 MODIFY를 건너뜀",
   "lang": "abap",
   "src": "LOOP AT materials INTO DATA(material).\n  \" 이미 기본값이 모두 들어가 있으면 다시 수정하지 않음\n  IF material-Vprsv IS NOT INITIAL\n     AND material-Waers IS NOT INITIAL\n     AND material-Peinh IS NOT INITIAL\n     AND material-Ersda IS NOT INITIAL.\n    CONTINUE.\n  ENDIF.\n  APPEND VALUE #(\n    %tky = material-%tky\n    Vprsv = COND #(\n      WHEN material-Vprsv IS INITIAL\n      THEN 'S'\n      ELSE material-Vprsv )\n    Waers = COND #(\n      WHEN material-Waers IS INITIAL\n      THEN zcl_a20_waers=>c_waers\n      ELSE material-Waers )\n    Peinh = COND #(\n      WHEN material-Peinh IS INITIAL\n      THEN 1\n      ELSE material-Peinh )\n    Meins = COND #(\n      WHEN material-Meins IS INITIAL\n      THEN 'EA'\n      ELSE material-Meins )\n    Ersda = COND #(\n      WHEN material-Ersda IS INITIAL\n      THEN cl_abap_context_info=>get_system_date( )\n      ELSE material-Ersda )\n  ) TO updates.\nENDLOOP.",
   "cap": "ZBP_R_A20_MARA"
  },
  {
   "h": "플랜트 → 평가영역 자동 설정 <code>setBwkey</code>",
   "d": "<code>Werks</code> 변경 시 실행되는 determination. 표준 플랜트 테이블 <code>t001w</code>에서 평가영역을 읽어 넣고, 값이 같으면 다시 MODIFY하지 않아 불필요한 재실행을 막음",
   "lang": "abap",
   "src": "LOOP AT materials INTO DATA(material).\n  \" 플랜트가 없으면 실행하지 않음\n  IF material-Werks IS INITIAL.\n    CONTINUE.\n  ENDIF.\n  \" 플랜트에 해당하는 평가영역 조회\n  SELECT SINGLE bwkey\n    FROM t001w\n    WHERE werks = @material-Werks\n    INTO @DATA(lv_bwkey).\n  \" 이미 같은 값이면 다시 MODIFY하지 않음\n  IF material-Bwkey = lv_bwkey.\n    CONTINUE.\n  ENDIF.\n  \" 평가영역 자동 입력\n  MODIFY ENTITIES OF zr_a20_mara IN LOCAL MODE\n    ENTITY Material\n      UPDATE FIELDS ( Bwkey )\n      WITH VALUE #(\n        (\n          %tky  = material-%tky\n          Bwkey = lv_bwkey\n        )\n      ).\nENDLOOP.",
   "cap": "ZBP_R_A20_MARA"
  },
  {
   "h": "자재유형–평가클래스 조합 검증 <code>validateValuation</code>",
   "d": "평가클래스 목록을 하드코딩하지 않고 표준 설정으로 판단: 자재유형 설정 <code>t134</code>의 계정범주참조(KKREF)를 읽은 뒤, <code>t134</code>–<code>t025</code> 조인 뷰 <code>ZI_A20_MTART_BKLAS_F4</code>에 해당 KKREF + 평가클래스가 있는지 확인. 없으면 메시지 006 / 007로 저장 차단",
   "lang": "abap",
   "src": "\" ========================================================\n\" 1. 자재유형(MTART)의 계정범주참조(KKREF) 조회\n\"\n\" 자재유형\n\"   ↓\n\" 계정범주참조\n\"   ↓\n\" 사용할 수 있는 평가클래스\n\" ========================================================\nSELECT SINGLE kkref\n  FROM t134       \" 자재유형(Material Type) 설정 테이블\n  WHERE mtart = @material-Mtart\n  INTO @DATA(lv_kkref).\n\" ...\n\" ========================================================\n\" 2. 선택한 평가클래스가 위 계정범주참조에 허용되는지 확인\n\" ========================================================\nSELECT SINGLE @abap_true\n  FROM ZI_A20_MTART_BKLAS_F4 \" 평가클래스(Valuation Class) 정보를 조회하기 위한 뷰\n  WHERE Bklas  = @material-Bklas\n    AND Kkref = @lv_kkref\n  INTO @DATA(lv_dummy).\nIF lv_dummy IS INITIAL.\n  \" ...\n  APPEND VALUE #(\n    %tky           = material-%tky\n    %element-Mtart = if_abap_behv=>mk-on\n    %element-Bklas = if_abap_behv=>mk-on\n    %msg = new_message(\n      id       = 'ZCM_A20_MM_MESSAGE'\n      number   = '007' \" 자재유형 &1에는 평가클래스 &2를 사용할 수 없습니다.\n      severity = if_abap_behv_message=>severity-error\n      v1       = material-Mtart\n      v2       = material-Bklas\n    )\n  ) TO reported-material.\nENDIF.",
   "cap": "ZBP_R_A20_MARA"
  },
  {
   "h": "자재명 KO · EN 필수 검증 <code>validateLanguage</code>",
   "d": "Root 저장 시 Composition 하위 자재명을 <code>BY \\_ChildText</code>로 읽어 언어키 3(한국어) · E(영어) 자재명이 모두 있는지 확인. 하나라도 없으면 메시지 008로 저장 차단",
   "lang": "abap",
   "src": "\" 현재 자재에 등록된 자재명(Text) 조회\nREAD ENTITIES OF zr_a20_mara IN LOCAL MODE\n  ENTITY Material BY \\_ChildText\n    FIELDS ( Spras Maktx )\n    WITH CORRESPONDING #( keys )\n  RESULT DATA(texts).\n\" 한국어 / 영어 존재 여부\nDATA lv_ko TYPE abap_bool VALUE abap_false.\nDATA lv_en TYPE abap_bool VALUE abap_false.\nLOOP AT texts INTO DATA(text).\n  IF TEXT-Spras = '3'\n     AND TEXT-Maktx IS NOT INITIAL.\n    lv_ko = abap_true.\n  ENDIF.\n  IF TEXT-Spras = 'E'\n     AND TEXT-Maktx IS NOT INITIAL.\n    lv_en = abap_true.\n  ENDIF.\nENDLOOP.\n\" 둘 중 하나라도 없으면 저장 불가\nIF lv_ko = abap_false\n   OR lv_en = abap_false.\n  LOOP AT keys INTO DATA(key).\n    APPEND VALUE #(\n      %tky = key-%tky\n    ) TO failed-material.\n    APPEND VALUE #(\n      %tky = key-%tky\n      %msg = new_message(\n        id       = 'ZCM_A20_MM_MESSAGE'\n        number   = '008' \" 자재명은 한국어(KO)와 영어(EN)를 모두 입력해야 합니다.\n        severity = if_abap_behv_message=>severity-error\n      )\n    ) TO reported-material.",
   "cap": "ZBP_R_A20_MARA"
  },
  {
   "h": "Instance Feature Control: Lock 상태 · 삭제 상태별 필드 · 버튼 제어",
   "d": "<code>Matfi</code>가 설정되면 플랜트 · 저장위치 · 자재유형 · 평가클래스를 읽기 전용으로 전환하고 Lock / Unlock 버튼을 서로 반대로 활성화. <code>Lvorm</code> 값에 따라 삭제 / 삭제 취소 버튼 활성화를 전환. 최초 저장 시에는 <code>setMatfi</code>(on save)가 <code>Matfi = 'X'</code>를 설정",
   "lang": "abap",
   "src": "result = VALUE #(\n  FOR material IN materials\n  (\n    %tky = material-%tky\n    \" =====================================================\n    \" 1. 주요정보 수정 가능 여부\n    \" =====================================================\n    %features-%field-Werks =\n      COND #(\n        WHEN material-Matfi IS INITIAL\n        THEN if_abap_behv=>fc-f-unrestricted\n        ELSE if_abap_behv=>fc-f-read_only\n      )\n    \" ...\n    %features-%action-unlockMaterial =\n      COND #(\n        WHEN material-Matfi = abap_true\n        THEN if_abap_behv=>fc-o-enabled\n        ELSE if_abap_behv=>fc-o-disabled\n      )\n    \" ...\n    %features-%action-lockMaterial =\n      COND #(\n        WHEN material-Matfi = abap_false\n        THEN if_abap_behv=>fc-o-enabled\n        ELSE if_abap_behv=>fc-o-disabled\n      )\n    \" ...\n    %features-%action-setDeletionFlag =\n      COND #(\n        WHEN material-Lvorm = abap_true\n        THEN if_abap_behv=>fc-o-disabled\n        ELSE if_abap_behv=>fc-o-enabled\n      )\n  \" ...\n  )\n).",
   "cap": "ZBP_R_A20_MARA"
  },
  {
   "h": "Instance Authorization: 생성자만 Lock · Unlock",
   "d": "<code>authorization : instance</code>로 선언한 Lock · Unlock Action에 대해 현재 사용자(<code>cl_abap_context_info=>get_user_technical_name( )</code>)와 자재의 <code>CreatedBy</code>를 비교해 허용 / 거부를 반환. 거부 시 메시지 009 표시",
   "lang": "abap",
   "src": "\" 현재 로그인 사용자\nDATA(lv_user) =\n  cl_abap_context_info=>get_user_technical_name( ).\n\" 선택한 자재의 생성자 조회\nREAD ENTITIES OF zr_a20_mara IN LOCAL MODE\n  ENTITY Material\n    FIELDS ( CreatedBy )\n    WITH CORRESPONDING #( keys )\n  RESULT DATA(materials).\nLOOP AT materials INTO DATA(material).\n  \" 현재 사용자가 해당 자재의 생성자인지 확인\n  DATA(lv_allowed) = COND #(\n    WHEN material-CreatedBy = lv_user\n    THEN if_abap_behv=>auth-allowed\n    ELSE if_abap_behv=>auth-unauthorized\n  ).\n  \" 생성자만 Lock / Unlock 실행 가능\n  APPEND VALUE #(\n    %tky = material-%tky\n    %action-unlockMaterial = lv_allowed\n    %action-lockMaterial   = lv_allowed\n  ) TO result.",
   "cap": "ZBP_R_A20_MARA"
  },
  {
   "h": "Interface View <code>ZI_A20_MARA</code>: 타 BO 참조용",
   "d": "삭제플래그가 없는 자재만, 한국어 자재명과 함께 노출. 구매정보 레코드 · 구매오더 · 입고 BO가 이 뷰로 자재를 조회하며, 입고 BO는 여기서 표준가격 · 가격단위 · 가격관리지시자 · 평가클래스를 읽어 전표 금액 계산과 511(V) 전표 생략 여부를 판단",
   "lang": "cds",
   "src": "define view entity ZI_A20_MARA\n  as select from ZR_A20_MARA as Mara\n  association [0..1] to ZR_A20_MARATEXT as _MaraText on $projection.MatUuid = _MaraText.MatUUID\n{\n  key Mara.MatUUID            as MatUuid,\n      Mara.Matnr              as Matnr,\n      _MaraText.Maktx         as Maktx,\n      // ...\n      Mara.Lvorm              as Lvorm,\n      // ...\n      _MaraText\n}\nwhere\n      Mara.Lvorm      is initial\n  and _MaraText.Spras = '3'",
   "cap": "ZI_A20_MARA"
  }
 ],
 "rap/1": [
  {
   "h": "Behavior Definition: Draft · Feature Control · Prepare",
   "d": "공급업체 분류는 생성 시 필수 · 수정 시 읽기 전용, 통화와 거래 종료는 <code>features : instance</code>로 인스턴스별 제어. <code>draft determine action Prepare</code>에 <code>validateRequiredFields</code>를 연결해 Draft 단계에서도 필수값 검사",
   "lang": "bdef",
   "src": "field ( features : instance )\nWaers,\nLoevm;\nfield ( mandatory )\nName1;\n// G/L 계정 연관된 이 계정 잇으면 삭제 안되게 하기\nfield ( numbering : managed )\nLifUUID;\n// 생성(Create)할 때 해당 필드를 필수 입력 필드로 지정\nfield ( mandatory : create )\nfdgrv;\n// 수정 시 조회만\nfield ( readonly : update )\nFdgrv,\nLifUUID;\n// ...\ncreate( precheck );\nupdate( precheck );\ndelete;\n// ...\ndraft determine action Prepare\n{\n  validation validateRequiredFields;\n}",
   "cap": "ZR_A20_LFA1"
  },
  {
   "h": "공급업체번호 채번 <code>setLifnr</code> (on save)",
   "d": "분류(A1~A6)를 Number Range 범위(01~06)로 매핑해 <code>cl_numberrange_runtime=>number_get</code>(객체 <code>ZNRA2003</code>)으로 번호를 받고, 분류 + 8자리 번호로 공급업체번호 생성 (예: A100000013). on save determination이므로 Activate 시점에만 채번",
   "lang": "abap",
   "src": "DATA lv_range TYPE c LENGTH 2.\nCASE vendor-Fdgrv.\n  WHEN 'A1'.\n    lv_range = '01'.\n  \" ...\n  WHEN 'A6'.\n    lv_range = '06'.\n  WHEN OTHERS.\n    CONTINUE.\nENDCASE.\n\" ========================================================\n\" 공급업체번호 Number Range 채번\n\" ========================================================\nTRY.\n    cl_numberrange_runtime=>number_get(\n      EXPORTING\n        object      = 'ZNRA2003'\n        nr_range_nr = lv_range\n        quantity    = 1\n      IMPORTING\n        number      = DATA(lv_number)\n    ).\n    DATA lv_num8  TYPE n LENGTH 8.\n    DATA lv_lifnr TYPE c LENGTH 10.\n    lv_num8 = lv_number.\n    lv_lifnr = |{ vendor-Fdgrv }{ lv_num8 }|.\n    \" 생성된 공급업체번호 반영\n    MODIFY ENTITIES OF zr_a20_lfa1 IN LOCAL MODE\n      ENTITY Vendor\n        UPDATE FIELDS ( Lifnr )\n        WITH VALUE #(\n          (\n            %tky  = vendor-%tky\n            Lifnr = lv_lifnr\n          )\n        ).",
   "cap": "ZBP_RA20_LFA1"
  },
  {
   "h": "채번 실패 처리 <code>validateLifnr</code>",
   "d": "Number Range 예외(<code>cx_nr_object_not_found</code>, <code>cx_number_ranges</code>)는 메시지 013으로 보고하고, 이어지는 validation이 공급업체번호가 비어 있으면 메시지 015(Number Range 설정 및 잔여 번호 확인)로 저장을 차단",
   "lang": "abap",
   "src": "    CATCH cx_nr_object_not_found\n          cx_number_ranges.\n      APPEND VALUE #(\n        %tky = vendor-%tky\n        %msg = new_message(\n          id       = 'ZCM_A20_MM_MESSAGE'\n          number   = '013' \" 공급업체번호 채번 중 오류가 발생했습니다.\n          severity = if_abap_behv_message=>severity-error\n        )\n      ) TO reported-vendor.\n\" ...\nLOOP AT vendors INTO DATA(vendor).\n  \" 공급업체 분류 자체가 잘못된 경우는\n  \" validateRequiredFields에서 처리\n  IF vendor-Fdgrv IS INITIAL.\n    CONTINUE.\n  ENDIF.\n  \" 공급업체번호가 생성되지 않았다면 채번 실패\n  IF vendor-Lifnr IS INITIAL.\n    APPEND VALUE #(\n      %tky = vendor-%tky\n    ) TO failed-vendor.\n    APPEND VALUE #(\n      %tky           = vendor-%tky\n      %element-Lifnr = if_abap_behv=>mk-on\n      %msg = new_message(\n        id       = 'ZCM_A20_MM_MESSAGE'\n        number   = '015' \" 공급업체번호를 생성할 수 없습니다. Number Range 설정 및 잔여 번호를 확인해주세요.\n        severity = if_abap_behv_message=>severity-error\n      )\n    ) TO reported-vendor.\n  ENDIF.",
   "cap": "ZBP_RA20_LFA1"
  },
  {
   "h": "필수값 · 분류 유효성 검증 <code>validateRequiredFields</code>",
   "d": "공급업체 분류가 비었으면 010, 도메인 고정값 기반 Value Help <code>zi_a20_fdgrv_f4</code>에 없는 분류면 014, 공급업체명이 비었으면 011. 필드 단위로 <code>%element</code>를 표시해 해당 입력란에 오류 강조",
   "lang": "abap",
   "src": "LOOP AT vendors INTO DATA(vendor).\n  IF vendor-Fdgrv IS INITIAL.\n    APPEND VALUE #(\n      %tky = vendor-%tky\n    ) TO failed-vendor.\n    APPEND VALUE #(\n      %tky           = vendor-%tky\n      %element-Fdgrv = if_abap_behv=>mk-on\n      %msg = new_message(\n        id       = 'ZCM_A20_MM_MESSAGE'\n        number   = '010' \" 공급업체 분류를 입력해주세요\n        severity = if_abap_behv_message=>severity-error\n      )\n    ) TO reported-vendor.\n  ELSE.\n    \" 공급업체 분류 유효성 확인\n    SELECT SINGLE Fdgrv\n      FROM zi_a20_fdgrv_f4\n      WHERE Fdgrv = @vendor-Fdgrv\n      INTO @DATA(dummy).\n    IF sy-subrc <> 0.\n      APPEND VALUE #(\n        %tky = vendor-%tky\n      ) TO failed-vendor.\n      APPEND VALUE #(\n        %tky           = vendor-%tky\n        %element-Fdgrv = if_abap_behv=>mk-on\n        %msg = new_message(\n          id       = 'ZCM_A20_MM_MESSAGE'\n          number   = '014' \" 해당하는 공급업체 분류가 존재하지 않습니다.\n          severity = if_abap_behv_message=>severity-error\n          v1       = vendor-Fdgrv\n        )\n      ) TO reported-vendor.\n    ENDIF.\n  ENDIF.",
   "cap": "ZBP_RA20_LFA1"
  },
  {
   "h": "조정계정 Value Help <code>ZI_A20_AKONT_F4</code>",
   "d": "G/L 계정 BO의 Interface View(<code>ZI_A20_SKA1</code>)와 영어 계정명을 조인해 대차대조표 계정(<code>Glact = 'X'</code>) 중 조정계정 유형 K만 제공. <code>validateAkont</code>도 같은 뷰를 조회해 목록 밖 계정은 메시지 030으로 차단",
   "lang": "cds",
   "src": "// 회사 G/L 계정에 등록된 계정 중,\n// 대차대조표 계정이면서 공급업체 조정계정으로 설정된 계정만 조회\n// 이유 :\n// 공급업체 거래에서 발생한 채무를 G/L에 자동 반영하기 위해\n// 대차대조표 계정 중 공급업체 조정계정으로 설정된 계정만 선택하도록 제한\n@AccessControl.authorizationCheck: #NOT_REQUIRED\n@EndUserText.label: '[A20] G/L 계정 Value Help'\ndefine view entity ZI_A20_AKONT_F4\n  as select from ZI_A20_SKA1     as Account\n    inner join   ZR_A20_SKA1TEXT as Text on  Account.SakUuid = Text.SakUuid\n                                         and Text.Spras       = 'E'\n{\n      @ObjectModel.text.element: ['AccountName']\n      @UI.textArrangement: #TEXT_LAST\n  key Account.Saknr as Akont,\n      Account.Glact as Glact,\n      Text.Txt20    as AccountName\n}\nwhere\n      Account.Glact = 'X'\n  and Account.Mitkz = 'K'",
   "cap": "ZI_A20_AKONT_F4"
  },
  {
   "h": "Instance Feature Control: 통화 · 거래 종료",
   "d": "통화는 항상 읽기 전용. 같은 키로 <code>%is_draft = mk-off</code> Active 데이터를 다시 읽어, Active가 있으면(기존 공급업체 수정) 거래 종료 입력 허용, 없으면(신규 생성) 읽기 전용",
   "lang": "abap",
   "src": "\" 현재 Vendor 데이터 조회\nREAD ENTITIES OF zr_a20_lfa1 IN LOCAL MODE\n  ENTITY Vendor\n    FIELDS ( Waers Loevm )\n    WITH CORRESPONDING #( keys )\n  RESULT DATA(vendors).\n\" Active 데이터 조회\nREAD ENTITIES OF zr_a20_lfa1 IN LOCAL MODE\n  ENTITY Vendor\n    FIELDS ( LifUUID )\n    WITH VALUE #(\n      FOR key IN keys\n      (\n        %tky      = key-%tky\n        %is_draft = if_abap_behv=>mk-off\n      )\n    )\n  RESULT DATA(active_vendors).\nresult = VALUE #(\n  FOR vendor IN vendors\n  (\n    %tky = vendor-%tky\n    \" 통화는 항상 수정 불가\n    %features-%field-Waers =\n      if_abap_behv=>fc-f-read_only\n    \" 삭제 플래그\n    \" Active 데이터가 없으면 신규 생성 → 수정 불가\n    \" Active 데이터가 있으면 기존 Vendor 수정 → 수정 가능\n    %features-%field-Loevm =\n      COND #(\n        WHEN line_exists(\n               active_vendors[\n                 KEY entity\n                 LifUUID = vendor-LifUUID\n               ]\n             )\n        THEN if_abap_behv=>fc-f-unrestricted\n        ELSE if_abap_behv=>fc-f-read_only\n      )\n    )\n).",
   "cap": "ZBP_RA20_LFA1"
  },
  {
   "h": "Interface View <code>ZI_A20_LFA1</code>: 타 BO 참조용",
   "d": "삭제(<code>Lvorm</code>) · 거래 종료(<code>Loevm</code>)된 공급업체를 제외. 구매정보 레코드 · 구매오더 · 입고 · 회계전표 BO가 Association으로 참조하고, 공급업체 Value Help(<code>ZI_A20_LFA1_F4</code>)도 이 뷰 기반",
   "lang": "cds",
   "src": "define view entity ZI_A20_LFA1\n  as select from ZR_A20_LFA1\n{\n  key LifUUID,\n      Lifnr,\n      Land1,\n// ...\nwhere\n      Lvorm is initial\n  and Loevm is initial",
   "cap": "ZI_A20_LFA1"
  }
 ],
 "rap/2": [
  {
   "h": "Behavior Definition: Draft · Feature Control · 사용 중지 Action",
   "d": "<code>delete</code>를 막고 <code>setDeletionFlag</code> / <code>cancelDeletionFlag</code> Action으로 논리 삭제. 계정번호 · 계정타입 · 계정유형은 <code>features : instance</code>로 인스턴스별 편집 가능 여부를 결정하고, <code>Edit</code>는 <code>with additional implementation</code>으로 안내 메시지 로직을 추가",
   "lang": "bdef",
   "src": "field ( numbering : managed, readonly : update )\nSakUuid;\n\n//해당 필드를 필수 입력값으로 지정\nfield ( mandatory )\nGlact;\n\n// 계정번호, 계정 유형, 계정 타입 : 다른 테이블에서 사용중이면 수정 불가\nfield ( features : instance )\nGlact,\nMitkz,\nSaknr;\n\ncreate;\nupdate;\n// delete;\n\nassociation _ChildText { create; with draft; }\n\n// 생성 시 필수값 검증\nvalidation validateAccount on save { create; update; field Saknr, Glact; }\n\n// 다른 BO에서 해당 계정을 사용중이면 바꿀 수 없다는 메세지\n// with additional implementation : RAP의 자동 프레임워크에 추가 코드를 끼워 넣겠다는 옵션\ndraft action Edit with additional implementation;\ndraft action Activate optimized;\ndraft action Discard ;\ndraft action Resume;\ndraft determine action Prepare;\n\n// 삭제 처리\naction ( features : instance )\nsetDeletionFlag result [1] $self;\n\n// 삭제 취소\naction ( features : instance )\ncancelDeletionFlag result [1] $self;",
   "cap": "ZR_A20_SKA1"
  },
  {
   "h": "Instance Feature Control: 참조 여부에 따른 필드 · 버튼 제어",
   "d": "저장된 계정인지, 계정결정(<code>zi_a20_t030</code>) · 공급업체(<code>zi_a20_lfa1</code>의 <code>Akont</code>)에서 사용 중인지 조회해 계정번호 · 계정타입 · 계정유형을 읽기 전용으로 전환. LVORM 값에 따라 사용 중지 / 사용 버튼을 활성 · 비활성",
   "lang": "abap",
   "src": "SELECT SINGLE @abap_true\n  FROM zi_a20_ska1\n  WHERE SakUuid = @ls_account-SakUuid\n  INTO @DATA(lv_exists).\n\n\" =========================================================\n\" 회계 계정 결정에서 사용 중인지 확인\n\" =========================================================\nSELECT SINGLE @abap_true\n  FROM zi_a20_t030\n  WHERE SakUuid = @ls_account-SakUuid\n    AND lvorm    = @abap_false\n  INTO @DATA(lv_t030_used).\n\n\" =========================================================\n\" 공급업체의 조정계정으로 사용 중인지 확인\n\" =========================================================\nSELECT SINGLE @abap_true\n  FROM zi_a20_lfa1\n  WHERE Akont = @ls_account-Saknr\n  INTO @DATA(lv_vendor_used).\n\" ...\nAPPEND VALUE #(\n  %tky = ls_account-%tky\n  \" ...\n  %field-Saknr = COND #(\n    WHEN lv_exists = abap_true\n      THEN if_abap_behv=>fc-f-read_only\n    ELSE\n      if_abap_behv=>fc-f-unrestricted\n  )\n\n  \" =======================================================\n  \" 사용 중인 G/L 계정이면 계정유형 수정 불가\n  \" =======================================================\n  %field-Glact = COND #(\n    WHEN lv_t030_used   = abap_true\n      OR lv_vendor_used = abap_true\n      THEN if_abap_behv=>fc-f-read_only\n    ELSE\n      if_abap_behv=>fc-f-unrestricted\n  )\n  \" ...\n  %action-setDeletionFlag = COND #(\n    WHEN ls_account-Lvorm = abap_true\n      THEN if_abap_behv=>fc-o-disabled\n    ELSE\n      if_abap_behv=>fc-o-enabled\n  )\n\n  \" =======================================================\n  \" 사용 버튼\n  \" 사용 중     : 비활성화\n  \" 사용 중지됨 : 활성화\n  \" =======================================================\n  %action-cancelDeletionFlag = COND #(\n    WHEN ls_account-Lvorm = abap_true\n      THEN if_abap_behv=>fc-o-enabled\n    ELSE\n      if_abap_behv=>fc-o-disabled\n  )\n\n) TO result.",
   "cap": "ZBP_R_A20_SKA1"
  },
  {
   "h": "setDeletionFlag: 참조 계정 차단 후 LVORM 설정",
   "d": "중복 키 제거 후 계정마다 회계 계정 결정(<code>zta20t030</code>, 미삭제 행) → 공급업체 조정계정 순으로 참조를 확인해 사용 중이면 <code>failed</code> / <code>reported</code>(메시지 004 · 005)로 차단. 미참조 계정만 모아 <code>MODIFY ENTITIES … UPDATE FIELDS ( Lvorm )</code>로 일괄 반영하고 결과를 다시 읽어 반환. <code>cancelDeletionFlag</code>는 같은 방식으로 LVORM 해제",
   "lang": "abap",
   "src": "LOOP AT accounts INTO DATA(account).\n\n  \" =======================================================\n  \" 1. 회계 계정 결정에서 사용 중인지 확인\n  \" =======================================================\n  SELECT SINGLE @abap_true\n    FROM zta20t030\n    WHERE sak_uuid = @account-SakUuid\n      AND lvorm    = @abap_false\n    INTO @DATA(lv_used).\n\n  IF lv_used = abap_true.\n\n    APPEND VALUE #(\n      %tky = account-%tky\n    ) TO failed-account.\n\n    APPEND VALUE #(\n      %tky           = account-%tky\n      %element-Lvorm = if_abap_behv=>mk-on\n\n      %msg = new_message(\n        id       = 'ZCM_A20_FI_MESSAGE'\n        number   = '004'\n        severity = if_abap_behv_message=>severity-error\n        v1       = account-Saknr\n      )\n    ) TO reported-account.\n\n    CONTINUE.\n  \" ...\n  \" =======================================================\n  \" 2. 공급업체 조정계정으로 사용 중인지 확인\n  \" =======================================================\n  SELECT SINGLE @abap_true\n    FROM zi_a20_lfa1\n    WHERE Akont = @account-Saknr\n    INTO @DATA(lv_vendor_used).\n\n  IF lv_vendor_used = abap_true.\n  \" ...\n  \" =======================================================\n  \" 3. 어디에서도 사용하지 않는 경우에만 사용 중지\n  \" =======================================================\n  APPEND VALUE #(\n    %tky  = account-%tky\n    Lvorm = abap_true\n  ) TO lt_updates.\n\nENDLOOP.\n\n\" =========================================================\n\" 참조되지 않는 G/L 계정만 삭제 처리\n\" =========================================================\nIF lt_updates IS NOT INITIAL.\n\n  MODIFY ENTITIES OF zr_a20_ska1 IN LOCAL MODE\n    ENTITY Account\n      UPDATE FIELDS ( Lvorm )\n      WITH lt_updates\n    FAILED DATA(mod_failed)\n    REPORTED DATA(mod_reported).\n\n  APPEND LINES OF mod_failed-account\n    TO failed-account.\n\n  APPEND LINES OF mod_reported-account\n    TO reported-account.",
   "cap": "ZBP_R_A20_SKA1"
  },
  {
   "h": "Edit 추가 구현: 사용 중 계정 안내",
   "d": "Draft Edit 시점에 계정결정 · 공급업체 조정계정 참조를 확인해, 사용 중인 계정이면 계정유형 · 계정타입을 변경할 수 없다는 Information 메시지(006)를 계정번호와 함께 표시",
   "lang": "abap",
   "src": "LOOP AT lt_account INTO DATA(ls_account).\n\n  \" 회계 계정 결정에서 사용 중인지 확인\n  SELECT SINGLE @abap_true\n    FROM zi_a20_t030\n    WHERE SakUuid = @ls_account-SakUuid\n      AND Lvorm   = @abap_false\n    INTO @DATA(lv_t030_used).\n\n  \" 공급업체 조정계정으로 사용 중인지 확인\n  SELECT SINGLE @abap_true\n    FROM zi_a20_lfa1\n    WHERE Akont = @ls_account-Saknr\n    INTO @DATA(lv_vendor_used).\n\n  IF lv_t030_used   = abap_true\n  OR lv_vendor_used = abap_true.\n\n    APPEND VALUE #(\n      %tky = ls_account-%tky\n\n      %msg = new_message(\n        id       = 'ZCM_A20_FI_MESSAGE'\n        number   = '006' \" G/L 계정 &1은 다른 BO에서 사용 중이므로 계정유형 및 계정타입을 변경할 수 없습니다.\n        severity = if_abap_behv_message=>severity-information\n        v1       = ls_account-Saknr\n      )\n    ) TO reported-account.\n\n  ENDIF.",
   "cap": "ZBP_R_A20_SKA1"
  },
  {
   "h": "Validation: 계정명 언어 중복 · 필수값",
   "d": "자식 Entity의 <code>validateSpras</code>는 같은 계정(<code>sak_uuid</code>)에 다른 텍스트 행이 같은 언어로 이미 있으면 언어 필드를 표시해 저장 차단(001). Root의 <code>validateAccount</code>는 계정번호 · 계정타입(<code>Glact</code>) 미입력 시 오류(002 · 003)",
   "lang": "abap",
   "src": "READ ENTITIES OF zr_a20_ska1 IN LOCAL MODE\n  ENTITY AccountText\n    FIELDS ( SakTextUuid SakUuid Spras )\n    WITH CORRESPONDING #( keys )\n  RESULT DATA(lt_text).\n\nLOOP AT lt_text INTO DATA(ls_text).\n\n  \"같은 계정에 같은 언어가 이미 존재하는지 확인\n  SELECT SINGLE @abap_true\n    FROM zta20ska1_t\n    WHERE sak_uuid      = @ls_text-SakUuid\n      AND spras         = @ls_text-Spras\n      AND sak_text_uuid <> @ls_text-SakTextUuid\n    INTO @DATA(lv_exists).\n\n  IF lv_exists = abap_true.\n\n    \"저장 실패 처리\n    APPEND VALUE #(\n      %tky = ls_text-%tky\n    ) TO failed-AccountText.\n\n    \"에러 메시지 전달\n    APPEND VALUE #(\n      %tky = ls_text-%tky\n\n      %msg = new_message(\n        id       = 'ZCM_A20_FI_MESSAGE'\n        number   = '001' \" 언어 &1이(가) 이미 존재합니다.\n        severity = if_abap_behv_message=>severity-error\n        v1       = ls_text-Spras\n      )\n\n      %element-Spras = if_abap_behv=>mk-on\n\n    ) TO reported-AccountText.",
   "cap": "ZBP_R_A20_SKA1"
  },
  {
   "h": "Interface View: 사용 중지 계정 제외",
   "d": "다른 BO가 참조하는 <code>ZI_A20_SKA1</code>은 <code>lvorm is initial</code> 조건으로 사용 중인 계정만 노출. 계정결정(<code>ZR_A20_T030</code>) · 조정계정 Value Help(<code>ZI_A20_AKONT_F4</code>) 등이 이 View를 기준으로 계정 조회",
   "lang": "cds",
   "src": "@AbapCatalog.viewEnhancementCategory: [#NONE]\n@AccessControl.authorizationCheck: #NOT_REQUIRED\n@EndUserText.label: '[A20] 타 BO에서 삭제되지 않은 계정을 조회하기 위한 Interface View'\n@Metadata.ignorePropagatedAnnotations: true\ndefine view entity ZI_A20_SKA1\n  as select from ZR_A20_SKA1\n{\n  key SakUuid,\n      Saknr,\n      AccName,\n      Glact,\n      GlactName,\n// ...\n}\nwhere\n  lvorm is initial",
   "cap": "ZI_A20_SKA1"
  }
 ],
 "rap/3": [
  {
   "h": "Behavior Definition: Late Numbering · 필드 제어",
   "d": "키(이동유형 + 순번) 중 순번을 <code>late numbering</code>으로 저장 직전에 확정. 순번 · 계정 UUID · 계정 타입은 읽기 전용, 이동유형은 생성 후 변경 불가. G/L 계정번호 입력 시 UUID 매핑 determination과 계정 검증 validation 선언",
   "lang": "bdef",
   "src": "define behavior for ZR_A20_T030 alias AccountDetermination\npersistent table zta20t030\nlock master\nauthorization master ( instance )\netag master LocalLastChangedAt\nlate numbering\n{\n  create;\n  update;\n  delete;\n  field ( mandatory )\n  Ktosl,\n  Ktopl,\n  Saknr;\n  field ( readonly : update )\n  Bwart;\n  // =========================================================\n  // 시스템에서 자동 설정\n  // =========================================================\n  field ( readonly )\n  Seqnr,\n  SakUuid,\n  Glact;\n  // ...\n  determination setSakUuid on modify\n  {\n    field Saknr;\n  }\n  // =========================================================\n  // G/L 계정 검증\n  // =========================================================\n  validation validateSaknr on save\n  {\n    create;\n    update;\n    field Saknr;\n  }",
   "cap": "ZR_A20_T030"
  },
  {
   "h": "순번 채번 <code>adjust_numbers</code> (Late Numbering)",
   "d": "Saver 클래스에서 <code>mapped</code>의 임시 키(<code>%tmp-Bwart</code>)로 같은 이동유형의 최대 순번을 조회해 + 1, 첫 등록이면 001. 확정된 이동유형 · 순번을 최종 키로 반환 (예: 101 / 001, 002 → 003)",
   "lang": "abap",
   "src": "METHOD adjust_numbers.\n  DATA lv_seqnr TYPE zta20t030-seqnr.\n  LOOP AT mapped-accountdetermination\n    ASSIGNING FIELD-SYMBOL(<account>).\n    \" 동일 이동유형의 현재 최대 순번 조회\n    SELECT SINGLE MAX( seqnr )\n      FROM zta20t030\n      WHERE bwart = @<account>-%tmp-Bwart\n      INTO @lv_seqnr.\n    \" 최초 등록\n    IF lv_seqnr IS INITIAL.\n      lv_seqnr = '001'.\n      \" 기존 데이터 존재\n    ELSE.\n      lv_seqnr = lv_seqnr + 1.\n    ENDIF.\n    \" 최종 Key 반환\n    <account>-Bwart = <account>-%tmp-Bwart.\n    <account>-Seqnr = lv_seqnr.\n  ENDLOOP.\nENDMETHOD.",
   "cap": "ZBP_R_A20_T030"
  },
  {
   "h": "계정과목표 기본값 · G/L 계정 UUID 매핑 <code>setKtopl</code> / <code>setSakUuid</code>",
   "d": "생성 시 계정과목표를 CAKR로 고정하고, 계정번호(<code>Saknr</code>)가 바뀌면 G/L 계정 테이블 <code>zta20ska1</code>에서 UUID를 찾아 <code>SakUuid</code>에 저장. 테이블에는 계정번호가 아닌 UUID로 G/L 계정 BO와 연결",
   "lang": "abap",
   "src": "MODIFY ENTITIES OF zr_a20_t030 IN LOCAL MODE\n  ENTITY AccountDetermination\n    UPDATE FIELDS ( Ktopl )\n    WITH VALUE #(\n      FOR key IN keys\n      (\n        %tky  = key-%tky\n        Ktopl = 'CAKR'\n      )\n    ).\n  \" ...\n  \" 입력한 G/L 계정번호에 해당하는 UUID 조회\n  SELECT SINGLE sak_uuid\n    FROM zta20ska1\n    WHERE saknr = @account-Saknr\n    INTO @DATA(lv_sak_uuid).\n  \" 존재하지 않는 계정은 validateSaknr에서 처리\n  IF sy-subrc <> 0.\n    CONTINUE.\n  ENDIF.\n  GET TIME STAMP FIELD DATA(lv_timestamp).\n  \" 조회한 UUID 설정\n  APPEND VALUE #(\n    %tky      = account-%tky\n    SakUuid   = lv_sak_uuid\n    CreatedAt = lv_timestamp\n    CreatedBy = sy-uname\n  ) TO updates.",
   "cap": "ZBP_R_A20_T030"
  },
  {
   "h": "G/L 계정 · 이동유형 검증 <code>validateSaknr</code> / <code>validateBwart</code>",
   "d": "계정번호가 비었으면 FI 메시지 015, <code>zta20ska1</code>에 없으면 016으로 차단. 이동유형은 Value Help 뷰 <code>zi_a20_bwart_f4</code>(101 · 102 · 311 · 511)에 있는 값만 허용하고 아니면 메시지 018",
   "lang": "abap",
   "src": "SELECT SINGLE @abap_true\n  FROM zta20ska1\n  WHERE saknr = @account-Saknr\n  INTO @DATA(lv_exists).\nIF sy-subrc <> 0.\n\" ...\nSELECT SINGLE @abap_true\n  FROM zi_a20_bwart_f4\n  WHERE GoodsMovementType = @account-Bwart\n  INTO @DATA(lv_bwart_exists).\nIF sy-subrc <> 0.\n  APPEND VALUE #(\n    %tky = account-%tky\n  ) TO failed-accountdetermination.\n  APPEND VALUE #(\n    %tky           = account-%tky\n    %element-Bwart = if_abap_behv=>mk-on\n    %msg = new_message(\n      id       = 'ZCM_A20_MM_MESSAGE'\n      number   = '018'   \" 이동유형 &1은 유효하지 않습니다.\n      severity = if_abap_behv_message=>severity-error\n      v1       = account-Bwart\n    )\n  ) TO reported-accountdetermination.",
   "cap": "ZBP_R_A20_T030"
  },
  {
   "h": "Value Help 연쇄 필터 (<code>additionalBinding</code>)",
   "d": "회계 결정 코드는 계정과목표로, 계정 수정자는 회계 결정 코드로, 평가클래스는 계정과목표 · 회계 결정 코드 · 계정 수정자로 필터. 계정 Value Help는 앞의 네 값 + 차/대변까지 <code>#FILTER_AND_RESULT</code>로 묶어, 선택 시 역으로 값이 채워지도록 구성",
   "lang": "cds",
   "src": "@Consumption.valueHelpDefinition: [{\n  entity: {\n      name: 'ZI_A20_KTOSL_F4',\n      element: 'TransactionKey'\n  },\n  additionalBinding: [{\n      localElement: 'Ktopl',\n      element: 'Ktopl',\n      usage: #FILTER\n  }]\n}]\n// ...\n@Consumption.valueHelpDefinition: [{\n      entity: {\n                  name: 'ZI_A20_SAKNR_F4',\n                  element: 'Saknr'\n              },\n      additionalBinding: [\n          {\n              localElement: 'Ktopl',\n              element: 'Ktopl',\n              usage: #FILTER_AND_RESULT\n          },\n          {\n              localElement: 'Ktosl',\n              element: 'TransactionKey',\n              usage: #FILTER_AND_RESULT\n          },\n          {\n              localElement: 'Komok',\n              element: 'Komok',\n              usage: #FILTER_AND_RESULT\n          },\n          {\n              localElement: 'Bklas',\n              element: 'Bklas',\n              usage: #FILTER_AND_RESULT\n          },\n          {\n              localElement: 'Shkzg',\n              element: 'Shkzg',\n              usage: #FILTER_AND_RESULT\n          }\n      ]",
   "cap": "ZC_A20_T030"
  },
  {
   "h": "계정 Value Help <code>ZI_A20_SAKNR_F4</code>: 표준 T030 기반 차/대변 계정",
   "d": "표준 계정결정 T030(CAKR)의 차변 계정(KONTS)과 대변 계정(KONTH)을 <code>union all</code>로 펼쳐 차/대변 지시자 S / H를 붙인 후보 목록으로 제공. 자체 G/L 계정(<code>ZI_A20_SKA1</code>)에 등록된 계정만 조인",
   "lang": "cds",
   "src": "define view entity ZI_A20_SAKNR_F4\n  /* ==============================\n     차변 계정\n     ============================== */\n  as select from ZI_A20_MMACC_F4 as TransactionKey\n    inner join   ZI_A20_SKA1     as Account     on Account.Saknr = TransactionKey.DebitAccount\n    inner join   ZI_A20_SHKZG_F4 as DebitCredit on DebitCredit.Shkzg = 'S'\n{\n  key TransactionKey.Ktopl  as Ktopl,\n  key TransactionKey.Ktosl  as TransactionKey,\n  key TransactionKey.Komok  as Komok,\n  key TransactionKey.Bklas  as Bklas,\n  key DebitCredit.Shkzg     as Shkzg,\n  key Account.Saknr         as Saknr,\n      DebitCredit.ShkzgText as ShkzgText,\n      Account.AccName       as AccName,\n      Account.Glact         as Glact\n}\n// ...\nunion all\n// ...\nselect from  ZI_A20_MMACC_F4 as TransactionKey\n  inner join ZI_A20_SKA1     as Account     on Account.Saknr = TransactionKey.CreditAccount\n  inner join ZI_A20_SHKZG_F4 as DebitCredit on DebitCredit.Shkzg = 'H'",
   "cap": "ZI_A20_SAKNR_F4"
  },
  {
   "h": "Interface View <code>ZI_A20_T030</code>: 입고 전표 계정결정",
   "d": "삭제 표시되지 않은 계정결정만 노출. 입고 BO는 이 뷰를 이동유형 + CAKR로 조회해 BSX · WRX · GBB 등 회계결정코드별 G/L 계정 UUID와 차/대변을 결정하며, 평가클래스가 지정된 행은 자재 평가클래스와 일치할 때만, 빈 행은 공통으로 사용",
   "lang": "cds",
   "src": "define view entity ZI_A20_T030\n  as select from ZR_A20_T030\n{\n  key Ktopl,\n  key Ktosl,\n  key Komok,\n  key Bwart,\n  key Seqnr,\n  key Bklas,\n      SakUuid,\n      Shkzg,\n      Lvorm,\n// ...\nwhere Lvorm is initial",
   "cap": "ZI_A20_T030"
  }
 ],
 "rap/4": [
  {
   "h": "Behavior Definition: Header 필드 제어 · Item Precheck",
   "d": "Header의 공급업체 · 자재 · 구매단위 · 취소 플래그는 <code>features : instance</code>로 저장 여부에 따라 제어하고, 번호 → UUID 매핑은 on save determination으로 분리. Item은 <code>update ( precheck )</code>로 Draft 반영 전에 값을 검사하고, 플랜트는 생성 시 필수 · 수정 시 읽기 전용",
   "lang": "bdef",
   "src": "field ( features : instance )\nLoekz,\nMeins,\nLifnr,\nMatnr;\nfield ( mandatory )\nMeins,\nMatnr;\n// ...\ndetermination MappingUUID on save\n{\n  create;                     // 생성할 때 실행\n  field Lifnr, Matnr;         // Lifnr 또는 Matnr가 변경될 때 실행\n}\ndetermination setRefField on modify { create; field Lifnr, Matnr; }\n// ...\n// Precheck\n// - UPDATE 요청이 실제 Draft 데이터에 반영되기 전에 입력값을 사전 검증\n// - 검증 오류 발생 시 UPDATE를 차단하여 잘못된 값이 Draft에 반영되는 것을 방지\n// - 가격단위(Peinh)는 0보다 큰 값만 허용\n// - 최소수량(Minbm)은 최대수량(Bstma)보다 클 수 없음\n// - 예정납품일수(Aplfz)는 0 이상만 허용\n// - 가격 유효종료일(Prdat)은 현재일 이전으로 설정할 수 없음\nupdate ( precheck );\n//update;\ndelete;\nfield ( features : instance )\nWaers;\nfield ( readonly )\nInfUuid,\nPlantName2,\nMeins;\nfield ( mandatory : create )\nWerks;\nfield ( readonly : update )\nWerks;",
   "cap": "ZR_A20_EINA"
  },
  {
   "h": "구매정보번호 연도별 채번 <code>SetInfnr</code> (on save)",
   "d": "시스템일자의 연도 2자리를 Number Range 범위로 사용해 <code>cl_numberrange_runtime=>number_get</code>(객체 <code>ZNRA2005</code>) 호출. 20자리로 반환되는 번호에서 뒤 10자리를 잘라 구매정보번호로 저장. on save이므로 Activate 시점에만 채번",
   "lang": "abap",
   "src": "DATA : lv_year TYPE c LENGTH 2.\nDATA : lv_infnr TYPE zta20eina-infnr.\nlv_year = sy-datum+2(2).\n\" ========================================================\n\" 구매정보레코드 Number Range 채번\n\" ========================================================\nTRY.\n    cl_numberrange_runtime=>number_get(\n        EXPORTING\n          object      = 'ZNRA2005'\n          nr_range_nr = lv_year\n          quantity    = 1\n        IMPORTING\n          number      = DATA(lv_number)\n      ).\n    \" lv_number은 20자리로 반환되기 때문에 해당 과정으로 뒤의 10자리를 가져와야 한다\n    lv_infnr = CONV zta20eina-infnr(\n      substring(\n        val = lv_number\n        off = 10\n        len = 10\n      )\n    ).\n    \" 생성된 구매정보레코드 반영\n    MODIFY ENTITIES OF zr_a20_eina IN LOCAL MODE\n      ENTITY PurchasingInfoRecord\n        UPDATE FIELDS ( Infnr )\n        WITH VALUE #(\n          (\n            %tky  = purchasinginforecord-%tky\n            Infnr = lv_infnr\n          )\n        ).",
   "cap": "ZBP_R_A20_EINA"
  },
  {
   "h": "공급업체 · 자재 번호 → UUID 매핑 <code>MappingUUID</code>",
   "d": "화면에서는 번호로 입력받고, 저장 시 Interface View <code>zi_a20_lfa1</code> · <code>zi_a20_mara</code>에서 UUID를 찾아 <code>LifUUID</code> · <code>MatUUID</code>에 저장. 값이 바뀐 경우에만 MODIFY. 같은 조회로 on modify <code>setRefField</code>가 공급업체명 · 자재명을 Draft에 즉시 채움",
   "lang": "abap",
   "src": "LOOP AT lt_eina INTO DATA(ls_eina).\n  \" 공급업체 번호 → UUID\n  SELECT SINGLE lifUuid,\n                name1\n    FROM zi_a20_lfa1\n    WHERE lifnr = @ls_eina-Lifnr\n    INTO @DATA(Vendor).\n  \" 자재번호 → UUID\n  SELECT SINGLE MatUuid,\n                Maktx\n    FROM zi_a20_mara\n    WHERE matnr = @ls_eina-Matnr\n    INTO @DATA(Material).\n  \" 기존 UUID와 새 UUID가 다른 경우에만 변경\n  IF ls_eina-LifUUID <> Vendor-LifUUID\n  OR ls_eina-MatUUID <> Material-MatUuid.\n    MODIFY ENTITIES OF zr_a20_eina IN LOCAL MODE\n      ENTITY PurchasingInfoRecord\n        UPDATE FIELDS ( LifUUID MatUUID )\n        WITH VALUE #(\n          (\n            %tky       = ls_eina-%tky\n            LifUUID    = Vendor-LifUUID\n            MatUUID    = Material-MatUuid\n          )\n        ).\n  ELSE.\n    CONTINUE.\n  ENDIF.",
   "cap": "ZBP_R_A20_EINA"
  },
  {
   "h": "중복 · Item 존재 검증 <code>validateDuplicateInfo</code> / <code>validateEine</code>",
   "d": "같은 공급업체 UUID + 자재 UUID 조합의 다른 구매정보 레코드가 <code>zi_a20_eina</code>에 있으면 메시지 027로 차단. 이어서 <code>BY \\_Item</code>으로 하위 Item을 읽어 한 건도 없으면 메시지 031로 차단",
   "lang": "abap",
   "src": "  \" 공급업체 + 자재 조합이 동일한 기존 데이터 조회\n  SELECT SINGLE infnr\n    FROM zi_a20_eina\n    WHERE LifUuid = @ls_info-LifUUID\n      AND MatUuid = @ls_info-MatUUID\n      AND InfUuid <> @ls_info-InfUUID\n    INTO @DATA(lv_inf_uuid).\n  IF sy-subrc = 0.\n\" ...\nLOOP AT keys INTO DATA(key).\n  READ ENTITIES OF zr_a20_eina IN LOCAL MODE\n    ENTITY PurchasingInfoRecord BY \\_Item \" 헤더를 기준으로 연결된 아이템을 조회\n    \" ENTITY PurchasingInfoItem ->        \" 아이템을 직접 기준으로 조회\n      FIELDS ( InfUuid )\n      WITH VALUE #(\n        ( %tky = key-%tky )\n      )\n      RESULT DATA(items).\n  IF items IS INITIAL.",
   "cap": "ZBP_R_A20_EINA"
  },
  {
   "h": "Item 사전 검증 <code>precheck_update</code>",
   "d": "<code>%control</code>로 이번 요청에 포함된 필드만 검사. 최소 · 최대 수량은 한쪽만 바뀌어도 비교할 수 있도록 기존 Draft 값을 <code>%is_draft = mk-on</code>으로 읽어 대조. 이외에 예정 배송 일수 0 미만, 유효 종료일이 오늘 이전이면 <code>failed</code>로 UPDATE 자체를 거부",
   "lang": "abap",
   "src": "READ ENTITIES OF zr_a20_eina IN LOCAL MODE\n    ENTITY PurchasingInfoItem\n    FIELDS ( Minbm Bstma )\n    WITH VALUE #(\n      FOR entity IN entities (\n        %tky      = entity-%tky\n        %is_draft = if_abap_behv=>mk-on \" Active 데이터가 아닌 Draft 데이터 조회\n      )\n    )\nRESULT DATA(lt_draft_items).\n  \" ...\n  IF ls_entity-%control-Peinh = if_abap_behv=>mk-on.\n    IF ls_entity-Peinh <= 0.\n  \" ...\n  IF ls_entity-%control-Minbm = if_abap_behv=>mk-on\n  OR ls_entity-%control-Bstma = if_abap_behv=>mk-on.\n    \" 현재 Draft에 저장되어 있는 기존 값 조회\n    READ TABLE lt_draft_items\n      INTO DATA(ls_draft)\n      WITH KEY %tky = ls_entity-%tky.\n    IF sy-subrc = 0.\n      \" ========================================================\n      \" 최소수량(Minbm)을 변경한 경우\n      \" ========================================================\n      IF ls_entity-%control-Minbm = if_abap_behv=>mk-on.\n        IF ls_entity-Minbm > ls_draft-Bstma.",
   "cap": "ZBP_R_A20_EINA"
  },
  {
   "h": "Item 기본값: 자재 마스터 참조 <code>setRefField</code>",
   "d": "Item 생성 시 상위 Header의 자재번호로 <code>zi_a20_mara</code>를 조회해 플랜트 · 표준가격 · 가격단위 · 통화를 Item에 반영. 같은 시점 <code>SetDefaultField</code>가 통화 KRW, 유효 종료일 9999-12-31을 설정",
   "lang": "abap",
   "src": "\" 구매정보레코드 Header 조회\nREAD ENTITIES OF zr_a20_eina IN LOCAL MODE\n  ENTITY PurchasingInfoRecord\n    FIELDS ( InfUUID Matnr )\n    WITH CORRESPONDING #( keys )\n  RESULT DATA(headers).\n\" 구매정보레코드 Item 조회\nREAD ENTITIES OF zr_a20_eina IN LOCAL MODE\n  ENTITY PurchasingInfoRecord BY \\_Item\n    FIELDS ( InfUuid Waers )\n    WITH CORRESPONDING #( keys )\n  RESULT DATA(items).\nLOOP AT headers INTO DATA(header).\n  \" Header의 자재번호로 자재마스터 조회\n  SELECT SINGLE\n         Werks,\n         Stprs,\n         Peinh,\n         Waers\n    FROM zi_a20_mara\n    WHERE Matnr = @header-Matnr\n    INTO @DATA(ls_material).\n  IF sy-subrc <> 0.\n    CONTINUE.\n  ENDIF.\n  \" 해당 Header에 속한 Item에 자재마스터 정보 반영\n  MODIFY ENTITIES OF zr_a20_eina IN LOCAL MODE\n    ENTITY PurchasingInfoItem\n      UPDATE FIELDS ( Werks Netpr Peinh Waers )\n      WITH VALUE #(\n        FOR item IN items\n        WHERE ( InfUuid = header-InfUuid )\n        (\n          %tky  = item-%tky\n          Werks = ls_material-Werks\n          Netpr = ls_material-Stprs\n          Peinh = ls_material-Peinh\n          Waers = ls_material-Waers\n        )\n      ).",
   "cap": "ZBP_R_A20_EINA"
  },
  {
   "h": "Header Feature Control: 저장 여부 기준 필드 잠금",
   "d": "<code>ChangedAt</code>이 비어 있으면(신규) 공급업체 · 자재 · 구매단위 입력 가능, 취소 플래그는 읽기 전용. 저장된 레코드는 반대로 전환",
   "lang": "abap",
   "src": "result = VALUE #(\n  FOR record IN records\n  (\n    %tky = record-%tky\n    \" 생성 시 삭제플래그 수정 불가\n    \" 저장된 데이터 수정 시 수정 가능\n    %features-%field-Loekz =\n      COND #(\n        WHEN record-ChangedAt IS INITIAL\n        THEN if_abap_behv=>fc-f-read_only\n        ELSE if_abap_behv=>fc-f-unrestricted\n      )\n    \" 생성 시 단위 입력 가능\n    \" 저장된 데이터 수정 시 수정 불가능\n    %features-%field-Meins =\n      COND #(\n        WHEN record-ChangedAt IS INITIAL\n        THEN if_abap_behv=>fc-f-unrestricted\n        ELSE if_abap_behv=>fc-f-read_only\n      )\n   \" ...\n   )\n).",
   "cap": "ZBP_R_A20_EINA"
  },
  {
   "h": "구매오더용 Value Help <code>ZI_A20_EINA_F4</code>",
   "d": "취소 · 삭제되지 않은 구매정보 레코드(<code>ZI_A20_EINA</code>)와 플랜트별 Item(<code>ZI_A20_EINE</code>)을 조인하고 공급업체 · 자재 · 한국어 자재명을 Association으로 연결. 구매오더 아이템의 구매정보번호 Value Help와 단가 · 수량 범위 조회에 사용",
   "lang": "cds",
   "src": "define view entity ZI_A20_EINA_F4\n  as select from ZI_A20_EINA as PurchasingInfoRecord\n    inner join ZI_A20_EINE as PurchasingInfoItem\n      on PurchasingInfoRecord.InfUuid = PurchasingInfoItem.InfUuid\n    association [0..1] to ZI_A20_LFA1 as _Vendor\n      on $projection.LifUuid = _Vendor.LifUUID\n    association [0..1] to ZI_A20_MARA as _Product\n      on $projection.MatUuid = _Product.MatUuid\n    association [0..1] to ZI_A20_MARATEXT as _ProductText\n      on  $projection.MatUuid = _ProductText.MatUUID\n      and _ProductText.Spras = '3'",
   "cap": "ZI_A20_EINA_F4"
  }
 ],
 "rap/5": [
  {
   "h": "구매오더 번호 채번 (ZNRA2006 / 구간 45)",
   "d": "Active 저장 시점의 <code>determination setEbeln on save</code>에서만 채번하므로 Draft 단계에서는 번호가 소모되지 않음. <code>cl_numberrange_runtime=>number_get</code> 결과 20자리 중 뒤 10자리를 구매오더 번호로 사용, 이미 번호가 있으면 건너뜀",
   "lang": "abap",
   "src": "LOOP AT orders INTO DATA(order).\n  \" 이미 구매오더번호가 존재하면 다시 채번하지 않음\n  IF order-Ebeln IS NOT INITIAL.\n    CONTINUE.\n  ENDIF.\n  TRY.\n      \" 구매오더번호 Number Range 채번\n      cl_numberrange_runtime=>number_get(\n        EXPORTING\n          nr_range_nr = '45'\n          object      = 'ZNRA2006'\n          quantity    = 1\n        IMPORTING\n          number      = DATA(lv_number)\n      ).\n    CATCH cx_number_ranges.\n      \" Determination에서는 failed / reported 사용 불가\n      CONTINUE.\n  ENDTRY.\n  \" Number Range에서 반환된 20자리 중 뒤 10자리 사용\n  DATA(lv_ebeln) = CONV zea20ebeln(\n    lv_number+10(10)\n  ).\n  \" 구매오더번호 반영\n  MODIFY ENTITIES OF zr_a20_ekko IN LOCAL MODE\n    ENTITY PurchaseOrder\n      UPDATE FIELDS ( Ebeln )\n      WITH VALUE #(\n        (\n          %tky  = order-%tky\n          Ebeln = lv_ebeln\n        )\n      ).",
   "cap": "ZBP_R_A20_EKKO"
  },
  {
   "h": "아이템 번호 Early Numbering (10 단위 증가)",
   "d": "<code>earlynumbering_cba_Item</code>에서 <code>LINK DATA</code>로 기존 아이템을 읽어 PO별 최대 <code>Ebelp</code>를 구하고, 이번 CREATE 요청에서 이미 번호가 부여된 아이템까지 포함해 +10씩 채번. Draft에서 재호출되어도 번호가 중복되지 않도록 처리",
   "lang": "abap",
   "src": "READ ENTITIES OF zr_a20_ekko IN LOCAL MODE\n  ENTITY PurchaseOrder BY \\_Item\n    FROM CORRESPONDING #( entities )\n    LINK DATA(lt_items).\n\" ...\nLOOP AT entities ASSIGNING FIELD-SYMBOL(<purchase_order>)\n                 GROUP BY <purchase_order>-EbelnUUID.\n  \" ----------------------------------------------------------\n  \" 1. 현재 구매오더의 기존 Item 중 가장 큰 EBELP 조회\n  \" ----------------------------------------------------------\n  lv_max_ebelp =\n    REDUCE #(\n      INIT lv_max = CONV zta20ekpo-ebelp( 0 )\n      FOR ls_item IN lt_items\n        USING KEY entity\n        WHERE (\n          source-EbelnUUID = <purchase_order>-EbelnUUID\n        )\n      NEXT lv_max =\n        COND #(\n          WHEN ls_item-target-Ebelp > lv_max\n          THEN ls_item-target-Ebelp\n          ELSE lv_max\n        )\n    ).\n  \" ...\n  LOOP AT entities ASSIGNING FIELD-SYMBOL(<entity>)\n                   USING KEY entity\n                   WHERE EbelnUUID = <purchase_order>-EbelnUUID.\n    LOOP AT <entity>-%target\n         ASSIGNING FIELD-SYMBOL(<item>).\n      \" mapped에 CID + 전체 Key 전달\n      APPEND CORRESPONDING #( <item> )\n        TO mapped-PurchaseOrderItem\n        ASSIGNING FIELD-SYMBOL(<mapped_item>).\n      \" 이미 번호가 있다면 다시 채번하지 않음\n      IF <item>-Ebelp IS INITIAL.\n        lv_max_ebelp += 10.\n        <mapped_item>-EbelnUUID = <entity>-EbelnUUID.\n        <mapped_item>-Ebelp     = lv_max_ebelp.\n      ENDIF.\n    ENDLOOP.",
   "cap": "ZBP_R_A20_EKKO"
  },
  {
   "h": "구매정보번호 Value Help 연동",
   "d": "<code>additionalBinding</code>으로 헤더 공급업체(<code>Lifnr</code>)를 필터로 넘기고, 선택한 구매정보 레코드의 자재 · 단가 · 단위 · 플랜트 · 저장위치 · 가격단위를 결과로 아이템 필드에 채움",
   "lang": "cds",
   "src": "@Consumption.valueHelpDefinition: [{\n  entity: {\n    name: 'ZI_A20_EINA_F4',\n    element: 'Infnr'\n  },\n  additionalBinding: [\n    {\n    localElement: 'Lifnr',\n    element: 'Lifnr',\n    usage: #FILTER        // 헤더에 입력한 공급업체 번호에 의해 구매정보번호 필터링됨\n    },\n    {\n    localElement: 'Matnr',\n    element: 'Matnr',\n    usage: #RESULT        // 입력한 구매정보레코드에 대한 자재번호가 다른 필드에 입력됨\n    },\n    {\n    localElement: 'Netpr',\n    element: 'Netpr',\n    usage: #RESULT        // 입력한 구매정보레코드에 대한 단가가 다른 필드에 입력됨\n    },\n    {\n    localElement: 'Meins',\n    element: 'Meins',\n    usage: #RESULT        // 입력한 구매정보레코드에 대한 단위가 다른 필드에 입력됨\n    },\n    // ...\n    {\n    localElement: 'Peinh',\n    element: 'Peinh',\n    usage: #RESULT        // 입력한 구매정보레코드에 대한 가격단위가 다른 필드에 입력됨\n    }\n  ]\n}]\nInfnr,              // 구매정보레코드 번호",
   "cap": "ZC_A20_EKPO"
  },
  {
   "h": "아이템 Precheck: 구매정보 레코드 기준 사전 검증",
   "d": "<code>update ( precheck )</code>로 Draft 반영 전에 검사. 변경 요청값(<code>%control</code>)을 Draft 값에 덮어쓴 뒤 구매정보 레코드 존재, 자재 · 구매단위 일치, 최소(<code>Minbm</code>) · 최대(<code>Bstma</code>) 구매수량을 확인하고 위반 시 <code>failed</code> 처리",
   "lang": "abap",
   "src": "\" 구매정보레코드 조회\nSELECT SINGLE\n       Infnr,\n       Matnr,\n       Meins,\n       Minbm,\n       Bstma\n  FROM zi_a20_prcin_f4\n  WHERE Infnr = @<item>-Infnr\n  INTO @DATA(purchase_info).\n\" 구매정보레코드가 존재하지 않는 경우\nIF sy-subrc <> 0.\n  APPEND VALUE #(\n    %tky = <item>-%tky\n  ) TO failed-PurchaseOrderItem.\n  APPEND VALUE #(\n    %tky           = <item>-%tky\n    %element-Infnr = if_abap_behv=>mk-on\n    %msg = new_message(\n      id       = 'ZCM_A20_MM_MESSAGE'\n      number   = '036' \" 구매정보레코드가 존재하지 않습니다\n      severity = if_abap_behv_message=>severity-error\n    )\n  ) TO reported-PurchaseOrderItem.\n  CONTINUE.\nENDIF.\n\" ...\n\" 최소 구매수량 미만\nIF <item>-Menge IS NOT INITIAL\n   AND purchase_info-Minbm IS NOT INITIAL\n   AND <item>-Menge < purchase_info-Minbm.\n  APPEND VALUE #(\n    %tky = <item>-%tky\n  ) TO failed-PurchaseOrderItem.\n  APPEND VALUE #(\n    %tky           = <item>-%tky\n    %element-Menge = if_abap_behv=>mk-on\n    %msg = new_message(\n      id       = 'ZCM_A20_MM_MESSAGE'\n      number   = '034' \" 구매수량은 최소 구매수량 &1 이상이어야 합니다.\n      severity = if_abap_behv_message=>severity-error\n      v1       = |{ purchase_info-Minbm }|\n    )\n  ) TO reported-PurchaseOrderItem.\n  CONTINUE.\nENDIF.",
   "cap": "ZBP_R_A20_EKKO"
  },
  {
   "h": "단가 검증: Error / Information / Warning 3단계",
   "d": "<code>validateNetpr</code>에서 음수는 Error, 0원은 무상 구매 Information, 구매정보 레코드(<code>zi_a20_eine</code>) 단가와 다르면 Warning. Information · Warning은 <code>failed</code>에 넣지 않아 저장은 허용",
   "lang": "abap",
   "src": "LOOP AT items INTO DATA(item).\n  \" 구매정보레코드의 기준 단가 조회\n  SELECT SINGLE Netpr\n    FROM zi_a20_eine\n    WHERE InfUuid = @item-InfUuid\n    INTO @DATA(price).\n  \" ========================================================\n  \" 1. 구매 단가 음수\n  \"    → Error\n  \" ========================================================\n  IF item-Netpr < 0.\n    \" ...\n    \" ========================================================\n    \" 2. 구매 단가 0원\n    \"    → Information\n    \" ========================================================\n  ELSEIF item-Netpr = 0.\n    APPEND VALUE #(\n      %tky           = item-%tky\n      %element-Netpr = if_abap_behv=>mk-on\n      %msg = new_message(\n        id       = 'ZCM_A20_MM_MESSAGE'\n        number   = '042' \" &1번 구매 단가가 0원입니다. 무상 구매로 처리됩니다.\n        severity = if_abap_behv_message=>severity-information\n        v1 = |{ item-Ebelp }|\n      )\n    ) TO reported-PurchaseOrderItem.\n    \" ...\n    \" ========================================================\n    \" 3. 구매정보레코드의 단가와 PO 단가 불일치\n    \"    → Warning\n    \" ========================================================\n  ELSEIF sy-subrc = 0\n     AND item-Netpr <> price.\n    APPEND VALUE #(\n      %tky           = item-%tky\n      %element-Netpr = if_abap_behv=>mk-on\n      %msg = new_message(\n        id       = 'ZCM_A20_MM_MESSAGE'\n        number   = '043' \" &3번 구매정보레코드에 대한 단가는 &1원 입니다. 입력하신 단가는 &2원 입니다.\n        severity = if_abap_behv_message=>severity-warning\n        v1 = |{ price      CURRENCY = item-Waers }|\n        v2 = |{ item-Netpr CURRENCY = item-Waers }|\n        v3 = |{ item-Ebelp }|\n      )\n    ) TO reported-PurchaseOrderItem.\n  ENDIF.",
   "cap": "ZBP_R_A20_EKKO"
  },
  {
   "h": "헤더 Feature Control",
   "d": "<code>get_instance_features</code>로 저장 이력(<code>ChangedAt</code>)과 취소 플래그(<code>Loekz</code>)에 따라 Delete · Edit · 취소 버튼을 동적 제어. Draft만 삭제 가능, 취소된 PO는 Edit 불가, 생성 중이거나 이미 취소된 PO는 취소 버튼 비활성",
   "lang": "abap",
   "src": "result = VALUE #(\n  FOR order IN orders\n  (\n    %tky = order-%tky\n    \" ...\n    \" Draft만 Delete 가능\n    \" Active는 Delete 불가\n    %features-%delete =\n      COND #(\n        WHEN order-%is_draft = if_abap_behv=>mk-on\n        THEN if_abap_behv=>fc-o-enabled\n        ELSE if_abap_behv=>fc-o-disabled\n      )\n    \" 수정 모드\n    \" 삭제 플래그 X : Edit 가능\n    \" 삭제 플래그 O : Edit 불가능\n    %features-%action-Edit =\n      COND #(\n        WHEN order-Loekz = 'X'\n        THEN if_abap_behv=>fc-o-disabled\n        ELSE if_abap_behv=>fc-o-enabled\n      )\n    \" 구매오더 취소 버튼 제어\n    %features-%action-setDeletionFlag =\n      COND #(\n        \" 생성 중에는 비활성화\n        WHEN order-ChangedAt IS INITIAL\n        THEN if_abap_behv=>fc-o-disabled\n        \" 이미 취소된 구매오더도 비활성화\n        WHEN order-Loekz = 'X'\n        THEN if_abap_behv=>fc-o-disabled\n        ELSE if_abap_behv=>fc-o-enabled\n      )\n  )\n).",
   "cap": "ZBP_R_A20_EKKO"
  },
  {
   "h": "취소 Action (파라미터 ZA_A20_DELETE)",
   "d": "<code>action ( features : instance ) setDeletionFlag parameter ZA_A20_DELETE</code>로 취소 사유를 팝업 입력받아 사유가 없으면 오류, 있으면 <code>Loekz</code> · <code>DelReason</code>을 갱신. 물리 삭제 대신 취소 플래그로 이력 보존",
   "lang": "abap",
   "src": "\" 삭제 사유 미입력 체크\nLOOP AT keys INTO DATA(key).\n  IF key-%param-DelReason IS INITIAL.\n    APPEND VALUE #(\n      %tky = key-%tky\n    ) TO failed-PurchaseOrder.\n    APPEND VALUE #(\n      %tky = key-%tky\n      %msg = new_message(\n        id       = 'ZCM_A20_MM_MESSAGE'\n        number   = '040' \" 취소 사유를 입력해주세요\n        severity = if_abap_behv_message=>severity-error\n      )\n    ) TO reported-PurchaseOrder.\n    CONTINUE.\n  ENDIF.\n  \" 구매오더 삭제 처리 + 삭제 사유 저장\n  MODIFY ENTITIES OF zr_a20_ekko IN LOCAL MODE\n    ENTITY PurchaseOrder\n      UPDATE FIELDS ( Loekz DelReason )\n      WITH VALUE #(\n        (\n          %tky      = key-%tky\n          Loekz     = abap_true\n          DelReason = key-%param-DelReason\n        )\n      ).",
   "cap": "ZBP_R_A20_EKKO"
  },
  {
   "h": "입고 BO 연동 Action: 누적 입고수량 반영",
   "d": "입고 BO가 <code>EXECUTE updateGoodsReceiptWemng</code>로 호출하는 Item Action. 파라미터 <code>Delta</code>를 기존 입고수량(<code>ReceivedMenge</code>)에 더해 101은 증가, 102는 감소",
   "lang": "abap",
   "src": "METHOD updateGoodsReceiptWemng.\n  \" 현재 구매오더 Item 조회\n  READ ENTITIES OF zr_a20_ekko IN LOCAL MODE\n    ENTITY PurchaseOrderItem\n      FIELDS ( ReceivedMenge )\n      WITH CORRESPONDING #( keys )\n      RESULT DATA(items).\n  LOOP AT items INTO DATA(item).\n    \" 현재 Action 요청값 조회\n    READ TABLE keys INTO DATA(key)\n      WITH KEY\n        EbelnUUID = item-EbelnUUID\n        Ebelp     = item-Ebelp.\n    IF sy-subrc <> 0.\n      CONTINUE.\n    ENDIF.\n    \" 기존 입고수량 + 현재 입고수량 증감\n    \"\n    \" 101 : Delta 양수 → 입고수량 증가\n    \" 102 : Delta 음수 → 입고수량 감소\n    MODIFY ENTITIES OF zr_a20_ekko IN LOCAL MODE\n      ENTITY PurchaseOrderItem\n        UPDATE FIELDS ( ReceivedMenge )\n        WITH VALUE #(\n          (\n            %tky          = item-%tky\n            ReceivedMenge = item-ReceivedMenge + key-%param-Delta\n          )\n        ).\n  ENDLOOP.\nENDMETHOD.",
   "cap": "ZBP_R_A20_EKKO"
  }
 ],
 "rap/6": [
  {
   "h": "입고문서 번호 채번: 이동유형별 번호 구간",
   "d": "첫 아이템의 이동유형으로 번호 구간을 결정(101 · 102 → 'GR', 311 · 511 → 'GM')해 <code>ZNRA2007</code>에서 채번. FI 전표 생성(<code>setDocument</code>)이 <code>setMblnr</code>보다 먼저 실행될 수 있어 채번 로직을 글로벌 클래스 <code>ZCL_A20_GR_NUMBER</code>로 분리하고 양쪽에서 호출, 이미 번호가 있으면 건너뜀",
   "lang": "abap",
   "src": "\" 첫 번째 Item의 이동유형에 따라 Number Range 결정\nCASE items[ 1 ]-Bwart.\n  WHEN '101' OR '102'.\n    lv_range = 'GR'.\n  WHEN '311' OR '511'.\n    lv_range = 'GM'.\n  WHEN OTHERS.\n    RETURN.\nENDCASE.\n\" 입고문서번호 채번\nTRY.\n    cl_numberrange_runtime=>number_get(\n      EXPORTING\n        nr_range_nr = lv_range\n        object      = 'ZNRA2007'\n        quantity    = 1\n      IMPORTING\n        number      = DATA(lv_number)\n    ).\n  CATCH cx_number_ranges.\n    RETURN.\nENDTRY.\n\" Header에 입고문서번호 반영\nMODIFY ENTITIES OF zr_a20_mkpf IN LOCAL MODE\n  ENTITY GoodsReceipt\n    UPDATE FIELDS ( Mblnr )\n    WITH VALUE #(\n      (\n        MblnrUuid = iv_mblnr_uuid\n        Mblnr     = lv_number+8(12)\n      )\n    ).",
   "cap": "ZCL_A20_GR_NUMBER"
  },
  {
   "h": "PO 아이템 선택 시 잔여수량 자동 매핑",
   "d": "<code>determination setMenge on modify { field Ebelp; }</code> + <code>side effects { field Ebelp affects field Menge, field Meins; }</code>. 101일 때 PO 발주수량에서 누적 입고수량을 뺀 잔여수량(음수면 0)과 단위를 입고 수량에 채움",
   "lang": "abap",
   "src": "IF item-Bwart <> '101'.\n  CONTINUE.\nENDIF.\n\" ...\nSELECT SINGLE Menge, Meins, ReceivedMenge\n  FROM zi_a20_ekpo\n  WHERE EbelnUuid = @item-EbelnUuid\n    AND Ebelp     = @item-Ebelp\n  INTO @DATA(ls_po_item).\nIF sy-subrc <> 0.\n  CONTINUE.\nENDIF.\n\" ========================================================\n\" 3. PO 잔여 입고수량 계산\n\"\n\" 잔여수량 = 발주수량 - 순입고수량\n\" ========================================================\nDATA(lv_remaining_menge) = ls_po_item-Menge - ls_po_item-ReceivedMenge.\n\" ========================================================\n\" 잔여수량이 음수인 경우 0으로 보정\n\" ========================================================\nIF lv_remaining_menge < 0.\n  lv_remaining_menge = 0.\nENDIF.\n\" ========================================================\n\" 4. 잔여수량 / 단위 자동 매핑\n\" ========================================================\nMODIFY ENTITIES OF zr_a20_mkpf IN LOCAL MODE\n  ENTITY GoodsReceiptItem\n    UPDATE FIELDS (\n      Menge\n      Meins\n    )\n    WITH VALUE #(\n      (\n        %tky  = item-%tky\n        Menge = lv_remaining_menge\n        Meins = ls_po_item-Meins\n      )\n    ).",
   "cap": "ZBP_R_A20_MKPF"
  },
  {
   "h": "누적 입고수량 검증 (과입고 방지)",
   "d": "<code>validateMenge</code>에서 현재 요청을 PO + PO 아이템별로 <code>COLLECT</code>(101 +, 102 -)한 뒤 DB 입고 이력을 더해 순입고수량을 계산. 현재 요청에 포함된 기존 아이템은 DB 합산에서 제외해 UPDATE 시 이중 계산을 막고, 발주수량 초과 시 해당 PO 아이템을 쓰는 모든 행에 오류 표시",
   "lang": "abap",
   "src": "  COLLECT VALUE ty_sum(\n    EbelnUUID = current_item-EbelnUUID\n    Ebeln     = current_item-Ebeln\n    Ebelp     = current_item-Ebelp\n    Menge     = lv_menge\n    Meins     = current_item-Meins\n  ) INTO lt_sum.\n\" ...\nLOOP AT lt_sum INTO DATA(sum).\n  DATA(lv_total_menge) = sum-Menge.\n  \" --------------------------------------------------------\n  \" 동일 PO + PO Item의 기존 입고 이력 조회\n  \" --------------------------------------------------------\n  SELECT\n    MblnrUuid,\n    Zeile,\n    Bwart,\n    Menge\n    FROM zi_a20_mseg\n    WHERE EbelnUUID = @sum-EbelnUUID\n      AND Ebelp     = @sum-Ebelp\n      AND ( Bwart = '101'\n       OR   Bwart = '102' )\n    INTO TABLE @DATA(history_items).\n  LOOP AT history_items INTO DATA(history_item).\n    \" ------------------------------------------------------\n    \" 현재 저장 요청에 포함된 Item인지 확인\n    \"\n    \" 포함되어 있으면 DB의 기존값은 합산하지 않음\n    \" RAP Buffer의 변경 후 값이 이미 lt_sum에 들어있음\n    \" ------------------------------------------------------\n    READ TABLE current_items\n      TRANSPORTING NO FIELDS\n      WITH KEY MblnrUuid = history_item-MblnrUuid\n               Zeile     = history_item-Zeile.\n    IF sy-subrc = 0.\n      CONTINUE.\n    ENDIF.\n    CASE history_item-Bwart.\n      WHEN '101'.\n        lv_total_menge += history_item-Menge.\n      WHEN '102'.\n        lv_total_menge -= history_item-Menge.\n    ENDCASE.\n  ENDLOOP.\n  \" ...\n  IF lv_total_menge > po_menge.",
   "cap": "ZBP_R_A20_MKPF"
  },
  {
   "h": "102 입고 취소: 원본 101 자동 연결",
   "d": "<code>setSmblnField</code>에서 같은 PO 아이템의 101 이력을 조회하고, 원본별 기존 102 취소수량을 차감해 잔여 취소가능수량이 남은 첫 101 아이템을 <code>SmblnUuid</code> · <code>Smblp</code>에 설정. 이 연결값을 <code>validateCancelMenge</code>(원본 수량 초과 취소 차단)와 역전표 참조에 사용",
   "lang": "abap",
   "src": "SELECT\n       MblnrUuid,\n       Zeile,\n       Menge\n  FROM zi_a20_mseg\n  WHERE Bwart     = '101'\n    AND EbelnUuid = @item-EbelnUuid\n    AND Ebelp     = @item-Ebelp\n  INTO TABLE @DATA(lt_original_items).\n\" ...\nLOOP AT lt_original_items INTO DATA(original_item).\n  \" 해당 원본 101에 대해 이미 처리된 102 취소수량\n  SELECT SUM( Menge )\n    FROM zi_a20_mseg\n    WHERE Bwart     = '102'\n      AND SmblnUuid = @original_item-MblnrUuid\n      AND Smblp     = @original_item-Zeile\n    INTO @DATA(lv_cancel_menge).\n  DATA lv_remaining_menge TYPE bstmg.\n  \" 원본 101의 현재 잔여 취소가능수량\n  lv_remaining_menge = original_item-Menge - lv_cancel_menge.\n  \" 취소 가능한 수량이 남아있는 원본 101만 선택\n  IF lv_remaining_menge <= 0.\n    \" validateCancelMenge에서 별도 처리\n    CONTINUE.\n  ENDIF.\n  \" 취소 대상 원본 101 Item 결정\n  ls_original_item = original_item.\n  EXIT.\n\" ...\nMODIFY ENTITIES OF zr_a20_mkpf IN LOCAL MODE\n  ENTITY GoodsReceiptItem\n    UPDATE FIELDS (\n      SmblnUuid\n      Smblp\n    )\n    WITH VALUE #(\n      (\n        %tky      = item-%tky\n        SmblnUuid = ls_original_item-MblnrUuid\n        Smblp     = ls_original_item-Zeile\n      )\n    ).",
   "cap": "ZBP_R_A20_MKPF"
  },
  {
   "h": "입고 BO → 구매오더 BO: 입고수량 반영",
   "d": "<code>setEkpoWemng on save</code>에서 아이템을 <code>GROUP BY</code>(PO UUID + PO 아이템 + 단위)로 묶어 101은 더하고 102는 빼서 증감량을 계산, 다른 BO인 구매오더의 <code>updateGoodsReceiptWemng</code> Action을 EML로 호출",
   "lang": "abap",
   "src": "LOOP AT items INTO DATA(item)\n  GROUP BY (\n    EbelnUuid = item-EbelnUuid\n    Ebelp     = item-Ebelp\n    Meins     = item-Meins\n  )\n  INTO DATA(group).\n  \" 구매오더 UUID / Item이 없는 경우 처리하지 않음\n  IF group-EbelnUuid IS INITIAL\n  OR group-Ebelp     IS INITIAL.\n    CONTINUE.\n  ENDIF.\n  DATA(gritem) = CONV zta20mseg-menge( 0 ).\n  \" ...\n  LOOP AT GROUP group INTO DATA(gr).\n    CASE gr-Bwart.\n      WHEN '101'.\n        gritem += gr-Menge.\n      WHEN '102'.\n        gritem -= gr-Menge.\n    ENDCASE.\n  ENDLOOP.\n  \" ========================================================\n  \" 구매오더 품목의 입고수량 반영\n  \" ========================================================\n  MODIFY ENTITIES OF zr_a20_ekko\n    ENTITY PurchaseOrderItem\n      EXECUTE updateGoodsReceiptWemng\n      FROM VALUE #(\n        (\n          %key-EbelnUUID = group-EbelnUuid\n          %key-Ebelp     = group-Ebelp\n          %param-Delta   = gritem\n          %param-Meins   = group-Meins\n        )\n      )\n    FAILED DATA(failed_po)\n    REPORTED DATA(reported_po).",
   "cap": "ZBP_R_A20_MKPF"
  },
  {
   "h": "입고완료 버튼: Feature Control + 구매오더 Action 호출",
   "d": "<code>action ( features : instance ) setGoodsReceiptComplete</code>. 참조 PO 아이템이 실제 존재할 때만 버튼을 활성화하고, 실행 시 구매오더 BO의 <code>updateGoodsReceiptComplete</code>를 호출해 PO 아이템 <code>Elikz</code>를 설정",
   "lang": "abap",
   "src": "  SELECT SINGLE *\n    FROM zi_a20_ekpo\n   WHERE EbelnUuid EQ @item-EbelnUuid\n     AND Ebelp     EQ @item-Ebelp\n    INTO @DATA(ls_ekpo).\n  APPEND VALUE #(\n    %tky = item-%tky\n    %features-%action-setGoodsReceiptComplete =\n        COND #(\n          WHEN sy-subrc = 0\n          THEN if_abap_behv=>fc-o-enabled\n          ELSE if_abap_behv=>fc-o-disabled\n        )\n\" ...\nLOOP AT items INTO DATA(item).\n  \" PO가 없는 경우 처리하지 않음\n  IF item-EbelnUUID IS INITIAL\n  OR item-Ebelp     IS INITIAL.\n    CONTINUE.\n  ENDIF.\n  \" ==============================================\n  \" 다른 BO인 구매오더의 Action 호출\n  \" ==============================================\n  MODIFY ENTITIES OF zr_a20_ekko\n    ENTITY PurchaseOrderItem\n      EXECUTE updateGoodsReceiptComplete\n      FROM VALUE #(\n        (\n          %tky = VALUE #(\n            EbelnUUID = item-EbelnUUID\n            Ebelp     = item-Ebelp\n          )\n        )\n      )\n    FAILED DATA(failed_po)\n    REPORTED DATA(reported_po).\nENDLOOP.",
   "cap": "ZBP_R_A20_MKPF"
  },
  {
   "h": "입고 → FI 전표 생성 (ZCL_A20_DOCUMENT_POST)",
   "d": "<code>setDocument on save</code>에서 <code>AWTYP = 'MKPF'</code>, <code>AWKEY</code> = 입고문서번호 + 연도로 기존 전표 Header를 찾고 없으면 <code>create_goods_receipt_header</code>로 생성(102는 원본 101 문서 UUID 전달), 이어서 아이템별 <code>create_goods_receipt_item</code> 호출. 두 메서드는 전표 BO의 <code>createDocumentHeader</code> / <code>createDocumentItem</code> Action을 실행",
   "lang": "abap",
   "src": "lv_awkey = |{ header-Mblnr }{ header-Mjahr }|.\nSELECT SINGLE BelnrUuid\n  FROM zi_a20_bkpf\n  WHERE Awtyp = 'MKPF'\n    AND Awkey = @lv_awkey\n  INTO @lv_belnr_uuid.\n\" ...\nIF lv_belnr_uuid IS INITIAL.\n  DATA(ls_header_result) =\n    zcl_a20_document_post=>create_goods_receipt_header(\n      is_gr_header = VALUE #(\n        MblnrUuid = header-MblnrUuid\n        Mblnr     = header-Mblnr\n        Mjahr     = header-Mjahr\n        Bldat     = header-Bldat\n        Budat     = header-Budat\n        Cpudt     = header-Cpudt\n        Bktxt     = header-Bktxt\n        Bwart     = item-Bwart\n        StblgUuid = lv_original_mblnr_uuid\n      )\n    ).\n\" ...\nDATA(ls_item_result) =\n  zcl_a20_document_post=>create_goods_receipt_item(\n    iv_belnr_uuid = lv_belnr_uuid\n    is_gr_item = VALUE #(\n  \" ...\n  ).\n\" ValidationDocument에서 업무조건 검증\n\" 실제 전표 Item 생성 실패는 사전 검증 불가\nIF ls_item_result-Success = abap_false.\n  RETURN.\nENDIF.",
   "cap": "ZBP_R_A20_MKPF"
  },
  {
   "h": "전표 금액 계산: BSX · WRX · PRD",
   "d": "BSX는 수량 × 표준가격 / 가격단위, WRX는 수량 × PO 단가 / 가격단위, 차액은 가격차이 PRD로 생성. 계정은 <code>zi_a20_t030</code>에서 이동유형 + 계정과목표 <code>CAKR</code>로 조회하고 평가클래스 · 계정키 · 차대변으로 선택하며, 전기키는 BSX 89/99 · WRX 86/96 · PRD 83/93 · GBB 83/93",
   "lang": "abap",
   "src": "DATA(lv_bsx_amount) =\n    CONV decfloat34( is_gr_item-Menge )\n  * CONV decfloat34( ls_material-Stprs )\n  / CONV decfloat34( ls_material-Peinh ).\n    \" ...\n    \" GR/IR 금액\n    lv_wrx_amount =\n        CONV decfloat34( is_gr_item-Menge )\n      * CONV decfloat34( ls_po_101-Netpr )\n      / CONV decfloat34( ls_po_101-Peinh ).\n    \" 가격차이\n    lv_prd_amount = lv_wrx_amount - lv_bsx_amount.\n        \" ...\n        WHEN 'PRD'. \" 가격차이\n          IF lv_prd_amount = 0. \" 가격차이 없을 땐 생성 안함\n            CONTINUE.\n          ENDIF.\n          \" PO가격 > 표준가격\n          IF lv_prd_amount > 0.\n            IF ls_account-Shkzg <> 'S'. \" 101에서는 PRD 차변\n              CONTINUE.\n            ENDIF.\n            lv_amount = lv_prd_amount.\n            \" PO가격 < 표준가격=\n          ELSEIF lv_prd_amount < 0.\n            IF ls_account-Shkzg <> 'H'.  \" 101에서는 PRD 대변\n              CONTINUE.\n            ENDIF.\n            lv_amount = abs( lv_prd_amount ).\n          ENDIF.",
   "cap": "ZCL_A20_DOCUMENT_POST"
  }
 ],
 "rap/7": [
  {
   "h": "Behavior Definition: Abstract Entity 파라미터 Action",
   "d": "외부(입고 BO)에서 전표를 만들 수 있도록 Header · Item에 각각 <code>createDocumentHeader</code> / <code>createDocumentItem</code> Action을 두고, 파라미터 구조는 Abstract Entity <code>ZA_A20_DOCUMENT_HEADER</code> / <code>ZA_A20_DOCUMENT_ITEM</code>으로 정의",
   "lang": "bdef",
   "src": "define behavior for ZR_A20_BKPF alias DocumentHeader\n  // ...\n  action createDocumentHeader\n    parameter ZA_A20_DOCUMENT_HEADER;\n// ...\ndefine behavior for ZR_A20_BSEG alias DocumentItem\n  // ...\n  action createDocumentItem\n    parameter ZA_A20_DOCUMENT_ITEM;",
   "cap": "ZR_A20_BKPF"
  },
  {
   "h": "Action 구현: 파라미터를 CREATE BY 연관으로 변환",
   "d": "<code>createDocumentItem</code>은 <code>%param</code> 값을 받아 부모 Header UUID 기준 <code>CREATE BY \\_DocumentItem</code>으로 Item을 생성(<code>%cid</code>는 전표 순번으로 구성). <code>createDocumentHeader</code>도 같은 방식으로 <code>CREATE FIELDS</code> 수행",
   "lang": "abap",
   "src": "LOOP AT keys INTO DATA(key).\n  MODIFY ENTITIES OF zr_a20_bkpf IN LOCAL MODE\n    ENTITY DocumentHeader\n    CREATE BY \\_DocumentItem\n    FIELDS (\n      \" ...\n      )\n      WITH VALUE #(\n        (\n          \" 부모 전표 Header UUID\n          BelnrUuid = key-BelnrUuid\n          \" 전표 Item 생성\n          %target = VALUE #(\n            (\n              \" 생성되는 Item을 식별하기 위한 CID\n              %cid      = |BSEG_{ key-%param-Buzei }|\n\n              Buzei     = key-%param-Buzei\n              Bschl     = key-%param-Bschl\n              Koart     = key-%param-Koart\n              Shkzg     = key-%param-Shkzg\n              HkontUuid = key-%param-HkontUuid\n              Wrbtr     = key-%param-Wrbtr\n              Waers     = key-%param-Waers\n              Sgtxt     = key-%param-Sgtxt\n              Werks     = key-%param-Werks\n              LifUuid   = key-%param-LifUuid\n              MatUuid   = key-%param-MatUuid\n            )\n          )\n        )\n      )\n      FAILED DATA(failed_item)\n      REPORTED DATA(reported_item)\n      MAPPED DATA(mapped_item).\n\nENDLOOP.",
   "cap": "ZBP_R_A20_BKPF"
  },
  {
   "h": "Header 생성 전 검사: 중복 방지 · 전표유형 결정",
   "d": "참조키(자재문서번호 + 연도)로 기존 Header를 찾아 있으면 그 UUID를 반환해 Header 중복 생성 방지. 신규면 UUID를 생성하고 이동유형별 전표유형(WE · WA)을 결정, 311은 전표 없이 성공 처리",
   "lang": "abap",
   "src": "lv_awkey = |{ is_gr_header-Mblnr }{ is_gr_header-Mjahr }|.\n\n\" 이미 생성된 전표 Header가 있는지 확인\n\" 존재하면 기존 전표 Header UUID를 가져와 Item에서 사용\nSELECT SINGLE belnr_uuid\n  FROM zta20bkpf\n WHERE awtyp = 'MKPF'\n   AND awkey EQ @lv_awkey\n  INTO @lv_belnr_uuid.\n\n\" 이미 생성된 전표 헤더라면 생성 안함\nIF sy-subrc EQ 0.\n  rs_result-Success   = abap_true.\n  rs_result-BelnrUuid = lv_belnr_uuid.\n  RETURN.\nENDIF.\n\n\" 전표 Header UUID 생성\nTRY.\n    lv_belnr_uuid = cl_system_uuid=>create_uuid_x16_static( ).\n  CATCH cx_uuid_error INTO DATA(lx_uuid_error).\n    rs_result-Message = '회계전표 UUID 생성에 실패했습니다.'.\n    RETURN.\nENDTRY.\n\n\" 이동유형에 대한 전표 유형 세팅\n\" 101, 102 : WE (입고 / 입고 취소)\n\" 311      : 전표 발생 안함\n\" 511      : WA (무상입고)\nCASE is_gr_header-bwart.\n\n  WHEN '101' OR '102'. \" 입고 / 입고 취소\n    lv_blart_type = zcl_a20_blart=>c_we.\n\n  WHEN '311'. \" 플랜트 내 이동\n    \" 저장위치 이동 시에는 전표 발생하지 않음\n    rs_result-Success = abap_true.\n    RETURN.\n\n  WHEN '511'. \" 무상입고\n    lv_blart_type = zcl_a20_blart=>c_wa.\n\nENDCASE.",
   "cap": "ZCL_A20_DOCUMENT_POST"
  },
  {
   "h": "102 원전표 조회 · 전표번호 채번",
   "d": "102 입고 취소는 원본 입고문서(<code>zi_a20_mkpf</code>) → 원본 전표(<code>zi_a20_bkpf</code>, AWTYP MKPF)를 따라가 원전표 UUID 확보. 전표번호는 번호범위 객체 <code>ZNRA2008</code>에서 전표유형을 구간 번호로 채번하고, 실패 시 메시지 반환",
   "lang": "abap",
   "src": "    SELECT SINGLE\n           Mblnr,\n           Mjahr\n      FROM zi_a20_mkpf\n     WHERE MblnrUuid = @is_gr_header-StblgUuid\n      INTO @DATA(ls_original_gr).\n\n    IF sy-subrc <> 0.\n      rs_result-Message = '102 취소 대상 원본 입고문서를 찾을 수 없습니다.'.\n      RETURN.\n    ENDIF.\n    \" ...\n    DATA(lv_original_awkey) = |{ ls_original_gr-Mblnr }{ ls_original_gr-Mjahr }|.\n\n    SELECT SINGLE BelnrUuid\n      FROM zi_a20_bkpf\n     WHERE Awtyp = 'MKPF'\n       AND Awkey = @lv_original_awkey\n      INTO @DATA(lv_original_belnr_uuid).\n\n    IF sy-subrc <> 0.\n      rs_result-Message = '원본 입고문서의 회계전표를 찾을 수 없습니다.'.\n      RETURN.\n\n    ENDIF.\n\" ...\nTRY.\n    cl_numberrange_runtime=>number_get(\n      EXPORTING\n        object      = 'ZNRA2008'\n        nr_range_nr = lv_blart_type\n        quantity    = 1\n      IMPORTING\n        number      = DATA(lv_number)\n    ).\n\n  CATCH cx_number_ranges INTO DATA(lx_number_range).\n\n    rs_result-Message = '회계전표번호 채번에 실패했습니다.'.\n    RETURN.\n\nENDTRY.",
   "cap": "ZCL_A20_DOCUMENT_POST"
  },
  {
   "h": "전표 Header 생성: EXECUTE createDocumentHeader",
   "d": "결정된 전표번호 · 전표유형 · 날짜 · 적요 · 참조키 · 원전표 UUID를 Action 파라미터로 넘겨 Header 생성. <code>FAILED</code>가 있으면 실패 메시지와 함께 종료",
   "lang": "abap",
   "src": "\" ============================================================\n\" 전표 Header 생성\n\" ============================================================\nMODIFY ENTITIES OF zr_a20_bkpf\n  ENTITY DocumentHeader\n EXECUTE createDocumentHeader\n    FROM VALUE #(\n      (\n        %tky = VALUE #(\n          BelnrUuid = lv_belnr_uuid\n        )\n        %param = VALUE #(\n          BelnrUuid = ls_bkpf-belnr_uuid\n          Belnr     = ls_bkpf-belnr\n          Gjahr     = ls_bkpf-gjahr\n          Blart     = ls_bkpf-blart\n          Bldat     = ls_bkpf-bldat\n          Budat     = ls_bkpf-budat\n          Cpudt     = ls_bkpf-cpudt\n          Bktxt     = ls_bkpf-bktxt\n          Waers     = ls_bkpf-waers\n          Awtyp     = ls_bkpf-awtyp\n          Awkey     = ls_bkpf-awkey\n          StblgUuid = ls_bkpf-stblg_uuid\n        )\n      )\n    )\n    FAILED DATA(failed_bkpf)\n    REPORTED DATA(reported_bkpf).\n\n\" Header 생성 실패 시 종료\nIF failed_bkpf IS NOT INITIAL.\n  rs_result-Message = '회계전표 Header 생성에 실패했습니다.'.\n  RETURN.\nENDIF.",
   "cap": "ZCL_A20_DOCUMENT_POST"
  },
  {
   "h": "금액 계산: BSX · WRX · PRD",
   "d": "자재마스터의 표준가격 · 가격단위로 재고금액(BSX)을, 구매오더 Item의 단가 · 가격단위로 GR/IR 금액(WRX)을 계산하고 차액을 가격차이(PRD)로 산출. 102도 같은 금액, 511은 가격제어 V면 전표 미생성",
   "lang": "abap",
   "src": "DATA(lv_bsx_amount) =\n    CONV decfloat34( is_gr_item-Menge )\n  * CONV decfloat34( ls_material-Stprs )\n  / CONV decfloat34( ls_material-Peinh ).\n  \" ...\n  WHEN '101'.\n\n    SELECT SINGLE\n           Netpr,\n           Peinh\n      FROM zi_a20_ekpo\n     WHERE EbelnUuid = @is_gr_item-EbelnUuid\n       AND Ebelp     = @is_gr_item-Ebelp\n      INTO @DATA(ls_po_101).\n    \" ...\n    \" GR/IR 금액\n    lv_wrx_amount =\n        CONV decfloat34( is_gr_item-Menge )\n      * CONV decfloat34( ls_po_101-Netpr )\n      / CONV decfloat34( ls_po_101-Peinh ).\n\n    \" 가격차이\n    lv_prd_amount = lv_wrx_amount - lv_bsx_amount.\n  \" ...\n  WHEN '511'.\n    IF ls_material-Vprsv = 'V'.\n      rs_result-Success = abap_true.\n      RETURN.\n\n    ENDIF.",
   "cap": "ZCL_A20_DOCUMENT_POST"
  },
  {
   "h": "계정결정 기반 라인 생성 · 차/대변 선택",
   "d": "이동유형 + 계정과목표 CAKR로 계정결정을 순번대로 조회하고, 평가클래스가 지정된 행은 자재 평가클래스와 같을 때만 사용. 101은 GR/IR 대변만, PRD는 가격차이 부호에 따라 차변(양수) · 대변(음수) 행을 선택하고 0이면 라인 미생성",
   "lang": "abap",
   "src": "SELECT Seqnr,\n       Ktosl,\n       Bklas,\n       Shkzg,\n       SakUuid\n  FROM zi_a20_t030\n WHERE Bwart = @is_gr_item-Bwart\n   AND Ktopl = 'CAKR'\n ORDER BY Seqnr\n  INTO TABLE @DATA(lt_account).\n  \" ...\n  IF ls_account-Bklas IS NOT INITIAL\n  AND ls_account-Bklas <> ls_material-Bklas.\n    CONTINUE.\n\n  ENDIF.\n    \" ...\n    WHEN '101'.\n\n      CASE ls_account-Ktosl.\n\n        WHEN 'BSX'. \" 재고자산\n          lv_amount = lv_bsx_amount.\n\n        WHEN 'WRX'. \" GR/IR\n          IF ls_account-Shkzg <> 'H'. \" 101 입고에서는 GR/IR 대변만 사용\n            CONTINUE.\n\n          ENDIF.\n\n          lv_amount = lv_wrx_amount.\n\n        WHEN 'PRD'. \" 가격차이\n\n          IF lv_prd_amount = 0. \" 가격차이 없을 땐 생성 안함\n            CONTINUE.\n\n          ENDIF.\n\n          \" PO가격 > 표준가격\n          IF lv_prd_amount > 0.\n\n            IF ls_account-Shkzg <> 'S'. \" 101에서는 PRD 차변\n              CONTINUE.\n\n            ENDIF.\n\n            lv_amount = lv_prd_amount.\n\n            \" PO가격 < 표준가격=\n          ELSEIF lv_prd_amount < 0.\n\n            IF ls_account-Shkzg <> 'H'.  \" 101에서는 PRD 대변\n              CONTINUE.\n\n            ENDIF.\n\n            lv_amount = abs( lv_prd_amount ).\n\n          ENDIF.",
   "cap": "ZCL_A20_DOCUMENT_POST"
  },
  {
   "h": "전기키 · 계정유형 결정 후 Item 생성: EXECUTE createDocumentItem",
   "d": "계정키 + 차/대변으로 전기키 결정(BSX 89/99 · WRX 86/96 · PRD · GBB 83/93), 계정유형은 전기키 Value Help CDS <code>zi_a20_bschl_f4</code>에서 조회. 구성한 라인을 Action으로 생성하고 순번(BUZEI)을 증가",
   "lang": "abap",
   "src": "  WHEN 'BSX'.\n    IF ls_account-Shkzg = 'S'.\n      lv_bschl = '89'. \"\n\n    ELSEIF ls_account-Shkzg = 'H'.\n      lv_bschl = '99'.\n\n    ELSE.\n      CONTINUE.\n\n    ENDIF.\n\" ...\nSELECT SINGLE Koart\n  FROM zi_a20_bschl_f4\n WHERE Bschl = @lv_bschl\n  INTO @DATA(lv_koart).\n\nIF sy-subrc <> 0.\n  rs_result-Message = |전기키 { lv_bschl }에 대한 계정유형을 찾을 수 없습니다.|.\n  RETURN.\n\nENDIF.\n\" ...\nMODIFY ENTITIES OF zr_a20_bkpf\n  ENTITY DocumentItem\n    EXECUTE createDocumentItem\n    FROM VALUE #(\n      (\n        %tky = VALUE #(\n          BelnrUuid = iv_belnr_uuid\n          Buzei     = ls_bseg-buzei\n        )\n        %param = VALUE #(\n          Buzei      = ls_bseg-buzei\n          Bschl      = ls_bseg-bschl\n          Koart      = ls_bseg-koart\n          Shkzg      = ls_bseg-shkzg\n          HkontUuid  = ls_bseg-hkont_uuid\n          Wrbtr      = ls_bseg-wrbtr\n          Waers      = is_gr_item-Waers\n          Sgtxt      = ls_bseg-sgtxt\n          Werks      = ls_bseg-werks\n          LifUuid    = ls_bseg-lif_uuid\n          MatUuid    = ls_bseg-mat_uuid\n        )\n      )\n    )\n    FAILED DATA(failed_bkpf)\n    REPORTED DATA(reported_bkpf).\n\nIF failed_bkpf IS NOT INITIAL.\n  rs_result-Message = |회계전표 Item 생성에 실패했습니다. 입고 Item: { is_gr_item-Zeile }|.\n  RETURN.\n\nENDIF.\n\nlv_buzei += 1.",
   "cap": "ZCL_A20_DOCUMENT_POST"
  }
 ],
 "rap/8": [
  {
   "h": "Behavior Definition: 읽기 전용 기간 필드 · 생성 Determination",
   "d": "UUID Key는 managed numbering, 회사코드 · 회계연도 · 기간 · 시작일 · 종료일은 <code>readonly</code>로 두고 생성 시 <code>SetDefaultField</code> Determination이 채움. Draft(Edit · Activate · Discard · Resume · Prepare) 지원",
   "lang": "bdef",
   "src": "field ( readonly, numbering : managed )\nPeriodUuid;\n\nfield ( readonly )\nBukrs,\nGjahr,\nMonat,\nDateFrom,\nDateTo,\nCreatedAt,\nCreatedBy,\nChangedAt,\nChangedBy,\nLocalLastChangedAt;\n\ndetermination SetDefaultField on modify { create; }\n\ncreate;\nupdate;\ndelete;\n\ndraft action Edit;\ndraft action Activate optimized;\ndraft action Discard;\ndraft action Resume;\ndraft determine action Prepare;",
   "cap": "ZR_A20_PERIOD"
  },
  {
   "h": "SetDefaultField: 당월 전기기간 자동 설정",
   "d": "시스템 일자로 월 시작일(YYYYMM01)을 만들고 <code>RP_LAST_DAY_OF_MONTHS</code>로 월말일을 구해, 회계연도 · 기간 · 시작일 · 종료일 · 오픈 Flag를 <code>MODIFY ENTITIES … IN LOCAL MODE</code>로 갱신",
   "lang": "abap",
   "src": "DATA(lv_today) = cl_abap_context_info=>get_system_date( ).\n\n\" 현재 월의 시작일\nDATA(lv_date_from) = CONV d(\n  |{ lv_today(6) }01|\n).\n\n\" 다음 달 1일 - 1일 = 현재 월 마지막일\nDATA(lv_date_to) = cl_abap_context_info=>get_system_date( ).\n\nCALL FUNCTION 'RP_LAST_DAY_OF_MONTHS'\n  EXPORTING\n    day_in            = lv_today\n  IMPORTING\n    last_day_of_month = lv_date_to.\n\nMODIFY ENTITIES OF zr_a20_period IN LOCAL MODE\n  ENTITY Pariod\n    UPDATE FIELDS (\n      Gjahr\n      Monat\n      DateFrom\n      DateTo\n      OpenFlag\n    )\n    WITH VALUE #(\n      FOR key IN keys\n      (\n        %tky     = key-%tky\n        Bukrs    = '1000'\n        Gjahr    = lv_today(4)\n        Monat    = lv_today+4(2)\n        DateFrom = lv_date_from\n        DateTo   = lv_date_to\n        OpenFlag = abap_true\n      )\n    ).",
   "cap": "ZBP_R_A20_PERIOD"
  },
  {
   "h": "Interface View: 전기 허용 기간만 노출",
   "d": "다른 BO가 참조하는 <code>ZI_A20_PERIOD</code>는 <code>OpenFlag is not initial</code>로 전기 허용된 기간만 노출",
   "lang": "cds",
   "src": "define view entity ZI_A20_PERIOD\n  as select from ZR_A20_PERIOD\n{\n\n  key Gjahr,\n  key Monat,\n  key DateFrom,\n  key DateTo,\n      OpenFlag\n}\nwhere\n  OpenFlag is not initial",
   "cap": "ZI_A20_PERIOD"
  },
  {
   "h": "입고 BO 전기일자 검증에서 참조",
   "d": "입고 BO의 <code>ValidateDateField</code>가 전기일자(Budat)를 포함하는 오픈 기간이 없으면 저장을 실패 처리하고 Budat 필드에 오류 메시지(<code>ZCM_A20_MM_MESSAGE</code> 052) 표시",
   "lang": "abap",
   "src": "LOOP AT goodsreceipts INTO DATA(goodsreceipt).\n\n  \" ========================================================\n  \" 전기기간 유효성 검사\n  \" Open된 전기기간의 시작일 ~ 종료일에 포함되지 않으면 Error\n  \" ========================================================\n  SELECT SINGLE @abap_true\n    FROM zi_a20_period\n    WHERE DateFrom <= @goodsreceipt-Budat\n      AND DateTo   >= @goodsreceipt-Budat\n    INTO @DATA(lv_valid_period).\n\n  IF sy-subrc <> 0.\n\n    APPEND VALUE #(\n      %tky = goodsreceipt-%tky\n    ) TO failed-GoodsReceipt.\n\n    APPEND VALUE #(\n      %tky = goodsreceipt-%tky\n\n      %msg = new_message(\n        id       = 'ZCM_A20_MM_MESSAGE'\n        number   = '052' \" 해당 일자는 허용된 전기기간에 포함되지 않습니다.\n        severity = if_abap_behv_message=>severity-error\n        v1       = |{ goodsreceipt-Budat DATE = USER }|\n      )\n\n      %element-Budat = if_abap_behv=>mk-on\n\n    ) TO reported-GoodsReceipt.",
   "cap": "ZBP_R_A20_MKPF"
  }
 ],
 "sd/1": [
  {
   "h": "전년도 판매량 CDS 조회",
   "d": "CDS View <code>zcds_d3_sd_0014</code>에서 자재 · 월(<code>audat</code> 5~6자리) · 영업조직별 전년도 판매량을 내부 테이블로 적재. 월 · 자재 · 영업조직 순 정렬로 자동 채움 시 <code>BINARY SEARCH</code> 조회 기반 마련, 계획 검증 · 차트에서도 같은 데이터 재사용",
   "lang": "abap",
   "src": "DATA: lv_year      TYPE n LENGTH 4,\n      lv_year_from TYPE sydatum,\n      lv_year_to   TYPE sydatum.\n\nREFRESH gt_layear_sum.\n\nlv_year = sy-datum(4) - 1.\n\nlv_year_from = |{ lv_year }0101|.\nlv_year_to   = |{ lv_year }1231|.\n\nSELECT matnr,\n       substring( audat, 5, 2 ) AS month,\n       vkorg,\n       kwmeng\n  FROM zcds_d3_sd_0014\n  INTO CORRESPONDING FIELDS OF TABLE @gt_layear_sum.\n\nSORT gt_layear_sum BY month matnr vkorg.",
   "cap": "ZD3SD0008F01"
  },
  {
   "h": "SOP 번호 재사용 · 채번",
   "d": "같은 계획월 · 영업조직 · 플랜트의 판매계획 헤더가 DB에 있는지 조인으로 먼저 확인하고, 미저장 생성분(<code>gt_plan_all</code>)까지 확인한 뒤에도 없을 때만 넘버레인지 <code>ZNRD3SD04</code>로 신규 번호(<code>PS</code> + 8자리) 발급과 헤더 생성. 기존 번호가 있으면 아이템만 추가",
   "lang": "abap",
   "src": "\" DB에 같은 달/영업조직/플랜트번호의 데이터가 존재하는지 확인\n\" 같은 데이터가 존재하면 헤더 데이터를 생성할 필요가 없다\nSELECT SINGLE a~plnnr\n  FROM       ztd3sd0004 AS a\n INNER JOIN  ztd3sd0005 AS b\n    ON a~plnnr EQ b~plnnr\n WHERE plan_month = @lv_plan_month\n   AND vkorg      = @gv_plan_vkorg\n   AND werks      = @gv_plan_werks\n  INTO @lv_plnnr.\n\nCLEAR gs_plan_all.\n\n\" DB에 저장되지 않은, ITAB에 이미 생성되었는지도 확인\n\" 반영이 이미 되어 있는 경우, lv_plnnr에 데이터가 들어온다\nREAD TABLE gt_plan_all INTO gs_plan_all\n  WITH KEY plan_month = lv_plan_month\n           vkorg      = gv_plan_vkorg\n           werks      = gv_plan_werks.\n\nlv_plnnr = gs_plan_all-plnnr.\n\n\" 기존의 판매계획번호가 존재하지 않는다면 넘버레인지 새로 발급해서 새로운 판매계획번호 생성\n\" 그에 따른 헤더 테이블도 생성\nIF lv_plnnr IS INITIAL.\n  \" 판매계획 key를 얻기 위한 넘버레인지\n  PERFORM get_plan_number CHANGING gv_plnnr.\n  \" DB에 저장하기 위한 헤더 ITAB에 데이터를 넣는 로직\n  PERFORM set_gs_insert_header.\n\nELSE.\n  \" 기존 판매계획번호가 존재한다면 아이템 테이블에만 추가하기 위해 기존의 판매계획 번호를 불러온다\n  gv_plnnr = lv_plnnr.\nENDIF.\n\n\" DB에 저장하기 위한 아이템 ITAB에 데이터를 넣는 로직\nPERFORM set_gs_insert_item.",
   "cap": "ZD3SD0008I01"
  },
  {
   "h": "다건 생성: 3개월 × 영업조직 행 자동 생성",
   "d": "트리에서 더블클릭한 완제품에 대해 다음달부터 3개월 × 영업조직(<code>1010</code>, <code>1020</code>) 조합의 입력 행 생성. 화면에 이미 있는 행 · 기존 계획 · MRP 반영된 달 · 사용자가 삭제한 행(<code>gt_plan_deleted</code>)은 건너뛰고, 12월을 넘으면 다음 해 1월로 넘김",
   "lang": "abap",
   "src": "IF gs_tree_map-matnr BETWEEN '0000200001' AND '0000200007'.\n  lv_plan_plant = 'P00002'.\nELSEIF gs_tree_map-matnr BETWEEN '0000200008' AND '0000200010'.\n  lv_plan_plant = 'P00001'.\nENDIF.\n\nlv_count      = 3.\nlv_plan_year  = sy-datum(4).\nlv_plan_month = sy-datum+4(2) + 1.\nlt_vkorg = VALUE #( ( '1010' ) ( '1020' ) ).\n\nDO lv_count TIMES.\n\n  LOOP AT lt_vkorg INTO lv_plan_vkorg.\n\n    READ TABLE gt_display4 TRANSPORTING NO FIELDS\n      WITH KEY plan_vkorg = lv_plan_vkorg\n               plan_matnr = gs_tree_map-matnr\n               plan_year  = lv_plan_year\n               plan_month = lv_plan_month.\n\n    IF sy-subrc = 0.\n      CONTINUE.\n    ENDIF.\n\" ...\n    READ TABLE gt_plan_all TRANSPORTING NO FIELDS\n      WITH KEY plan_month = |{ lv_plan_year }{ lv_plan_month WIDTH = 2 ALIGN = RIGHT PAD = '0' }|\n               matnr      = gs_tree_map-matnr\n               mrp_stat   = 'X'.\n\n    IF sy-subrc = 0.\n      CONTINUE.\n    ENDIF.\n\" ...\n    CLEAR gs_display4.\n\n    gs_display4-plan_vkorg = lv_plan_vkorg.\n    gs_display4-plan_matnr = gs_tree_map-matnr.\n    gs_display4-plan_matnm = lv_matnm.\n    gs_display4-plan_year  = lv_plan_year.\n    gs_display4-plan_month = lv_plan_month.\n    gs_display4-plan_meins = 'EA'.\n    gs_display4-plan_werks = lv_plan_plant.\n\n    APPEND gs_display4 TO gt_display4.\n\n  ENDLOOP.\n\n  lv_plan_month += 1.\n\n  IF lv_plan_month GE 13.\n    lv_plan_month = 1.\n    lv_plan_year += 1.\n  ENDIF.\n\nENDDO.",
   "cap": "ZD3SD0008F01"
  },
  {
   "h": "수정 · 조회 모드 전환",
   "d": "ALV 툴바 버튼(<code>PO_CNANGE</code>)으로 <code>set_ready_for_input</code>을 1/0 전환. 수정 모드에서도 셀 스타일(<code>set_edit_style</code>)로 이번달까지 · MRP 반영 건의 계획 수량은 <code>mc_style_disabled</code> 처리",
   "lang": "abap",
   "src": "  \" 입력한 값 변경\nWHEN 'PO_CNANGE'.\n  \" DB에 반영된 건을 저장하는 로직을 실행시기키 위한 bool 세팅\n  gv_after_edit  = abap_true.\n\n  \" 수정 모드로\n  IF gv_edit = abap_false.\n    gv_edit = abap_true.\n\n    CALL METHOD go_alv_grid->set_ready_for_input\n      EXPORTING\n        i_ready_for_input = 1.\n    \" 조회 모드로\n  ELSEIF gv_edit = abap_true.\n    gv_edit = abap_false.\n\n    CALL METHOD go_alv_grid->set_ready_for_input\n      EXPORTING\n        i_ready_for_input = 0.\n\n  ENDIF.",
   "cap": "ZD3SD0008F01"
  },
  {
   "h": "DATA_CHANGED 실시간 입력 검증",
   "d": "<code>mc_evt_modified</code>로 등록한 <code>DATA_CHANGED</code> 이벤트에서 변경 셀을 순회. 숫자 변환 실패는 <code>TRY-CATCH</code>(<code>cx_sy_conversion_no_number</code>), 음수는 경고로 <code>add_protocol_entry</code> 메시지를 남기고 <code>modify_cell</code>로 이전 값 복구. 정상 값은 <code>C510</code> 행 색으로 변경 표시. 다건 생성 ALV의 <code>PLAN_MENGE</code>도 같은 방식으로 검증",
   "lang": "abap",
   "src": "LOOP AT po_changed->mt_mod_cells INTO ls_mod_cell.\n\n  CASE ls_mod_cell-fieldname.\n\n    WHEN 'MENGE'.\n\n      READ TABLE gt_display INTO gs_display INDEX ls_mod_cell-row_id.\n      IF sy-subrc <> 0.\n        CONTINUE.\n      ENDIF.\n\n      lv_re_menge = gs_display-menge.\n\n      TRY.\n          gs_display-menge = ls_mod_cell-value.\n\n        CATCH cx_sy_conversion_no_number.\n          CALL METHOD po_changed->add_protocol_entry\n            EXPORTING\n              i_msgid     = 'ZPD3_MSG'\n              i_msgty     = 'E'\n              i_msgno     = '090'\n              i_fieldname = ls_mod_cell-fieldname\n              i_row_id    = ls_mod_cell-row_id.\n\n          CALL METHOD po_changed->modify_cell\n            EXPORTING\n              i_row_id    = ls_mod_cell-row_id\n              i_fieldname = ls_mod_cell-fieldname\n              i_value     = lv_re_menge.\n\n          CONTINUE.\n      ENDTRY.\n\n      \" 음수 입력 불가\n      IF gs_display-menge < 0.\n\n        CALL METHOD po_changed->add_protocol_entry\n          EXPORTING\n            i_msgid     = 'ZPD3_MSG'\n            i_msgty     = 'W'      \" 경고\n            i_msgno     = '334'    \" 음수 입력은 불가능합니다.\n            i_fieldname = ls_mod_cell-fieldname\n            i_row_id    = ls_mod_cell-row_id.\n\" ...\n        CONTINUE.\n\n      ENDIF.\n\n      gs_display-line_color = 'C510'.\n\n      MODIFY gt_display FROM gs_display INDEX ls_mod_cell-row_id\n        TRANSPORTING menge line_color.",
   "cap": "ZD3SD0008F01"
  },
  {
   "h": "자동 채움: 호출 화면 기준 분기",
   "d": "자동 채움 옵션 팝업(0150)을 메인(0100)과 다건 생성(0140) 화면이 공유하고, 호출 시 저장한 <code>gv_before_dynnr</code>로 대상 테이블 분기. 작년도 판매량 기준은 입력한 % 적용 후 <code>round_half_up</code> 반올림, 작년도 판매량 + PIR 기준은 CDS <code>zcds_d3_sd_0015</code>의 PIR 계획 수량(<code>plnmg</code>)을 전년도 판매량에 합산",
   "lang": "abap",
   "src": "  \" 작년도 판매량 기준 자동 채움\nWHEN gv_op3.\n  IF gv_before_dynnr = 0100.\n    PERFORM popup_to_confirm USING sy-ucomm\n                                   gv_ok.\n    PERFORM fill_auto_plan_qty_last_0100.\n    PERFORM refresh_alv_0100.\n\n  ELSEIF gv_before_dynnr = 0140.\n    \" 전체 제품의 작년 달별 판매량 계산\n    PERFORM sum_lastmonth_qua.\n    PERFORM popup_to_confirm USING sy-ucomm\n                             gv_ok.\n    PERFORM fill_auto_plan_qty_last_0140.\n    PERFORM refresh_alv_0140.\n  ENDIF.\n\n  \" 전년도 판매량 + PIR\nWHEN gv_op5.\n\n  PERFORM select_pir_data.\n\n  IF gv_before_dynnr = 0100.\n    PERFORM popup_to_confirm USING sy-ucomm\n                       gv_ok.\n    PERFORM fill_auto_plan_qty_la_pir_0100.\n    PERFORM refresh_alv_0100.\n\n  ELSEIF gv_before_dynnr = 0140.\n\n    \" 전체 제품의 작년 달별 판매량 계산\n    PERFORM sum_lastmonth_qua.\n\n    IF sy-ucomm IS NOT INITIAL.\n      PERFORM popup_to_confirm USING sy-ucomm\n                                     gv_ok.\n    ENDIF.\n    PERFORM fill_auto_plan_qty_la_pir_0140.\n    PERFORM refresh_alv_0140.\n  ENDIF.",
   "cap": "ZD3SD0008I01"
  },
  {
   "h": "계획 검증: 전년 동월 대비 셀 색상",
   "d": "<code>NOT EXISTS</code> 서브쿼리로 전년도 판매가 없는 완제품을 먼저 골라 검증 대상에서 제외하고, MRP 반영 건 · 이번달까지 건도 건너뜀. 나머지는 전년 동월 · 동일 영업조직 판매량 대비 90% 미만이면 빨강, 110% 초과면 노랑으로 <code>MENGE</code> 셀 색 지정",
   "lang": "abap",
   "src": "SELECT a~matnr\n  FROM ztd3mm0001 AS a\n WHERE a~matnr LIKE '00002%'\n   AND NOT EXISTS (\n     SELECT *\n       FROM ztd3sd0007 AS b\n       INNER JOIN ztd3sd0006 AS c\n         ON c~vbeln = b~vbeln\n      WHERE a~matnr = b~matnr\n        AND c~audat BETWEEN @lv_year_from AND @lv_year_to\n        AND b~lvorm = @space\n        AND c~lvorm = @space\n   )\n  INTO CORRESPONDING FIELDS OF TABLE @lt_matnr.\n\" ...\nLOOP AT gt_display INTO gs_display.\n\n  READ TABLE lt_matnr INTO ls_matnr\n        WITH KEY matnr = gs_display-matnr.\n\n  \" 작년 판매가 없는 데이터에 대해서는 KPI를 띄우지 않는다\n  IF sy-subrc EQ 0.\n    CONTINUE.\n  ENDIF.\n\" ...\n  READ TABLE gt_layear_sum INTO gs_layear_sum\n    WITH KEY month = lv_month\n             matnr = gs_display-matnr\n             vkorg = gs_display-vkorg.\n\n  IF sy-subrc = 0.\n\n    CLEAR ls_color.\n    ls_color-fname = 'MENGE'.\n\n    IF gs_display-menge < gs_layear_sum-kwmeng * '0.9'.\n\n      ls_color-color-col = 6. \" 빨강\n      ls_color-color-int = 1.\n      ls_color-color-inv = 0.\n      APPEND ls_color TO gs_display-cell_color.\n\n    ELSEIF gs_display-menge > gs_layear_sum-kwmeng * '1.1'.\n\n      ls_color-color-col = 3. \" 파랑\n      ls_color-color-int = 1.\n      ls_color-color-inv = 1.\n      APPEND ls_color TO gs_display-cell_color.\n\n    ENDIF.",
   "cap": "ZD3SD0008F01"
  },
  {
   "h": "저장: 변경 유형별 분기 · COMMIT/ROLLBACK",
   "d": "저장 확인 팝업 후 수정분(<code>gv_after_edit</code>), 단건 생성분(<code>gv_after_0110</code>), 다건 생성분(<code>gv_after_0140</code>) 플래그에 따라 UPDATE/INSERT 경로 분기. 다건 생성분은 헤더 · 아이템을 <code>INSERT ... FROM TABLE</code>로 일괄 반영하고 결과에 따라 <code>COMMIT WORK</code> / <code>ROLLBACK WORK</code>",
   "lang": "abap",
   "src": "FORM save_database .\n\n  CHECK gv_ok IS NOT INITIAL.\n  CALL METHOD go_alv_grid->check_changed_data.\n\n  \" 데이터 수정 시 실행되는 로직\n  IF gv_after_edit = abap_true.\n\n    PERFORM edit_plan.\n    CLEAR gv_after_edit.\n\n  ENDIF.\n\n  \" 데이터 생성 시 실행되는 로직(단건) -> 단건만 실행했을 때\n  IF gv_after_0110 = abap_true AND gv_after_0140 = space.\n\n    PERFORM add_plan.\n    CLEAR gv_after_0110.\n\n    \" 데이터 생성 시 실행되는 로직(다건) -> 다건만 실행했을 떄\n  ELSEIF gv_after_0140 = abap_true AND gv_after_0110 = space.\n\n    PERFORM add_multi_plan.\n\n    CLEAR gv_after_0140.\n\n    \" 데이터 생성 시 실행되는 로직 다건 & 단건 둘다 실행 했을 떄\n  ELSEIF gv_after_0140 = abap_true AND gv_after_0110 = abap_true.\n\n    PERFORM add_multi_plan.\n\n    CLEAR gv_after_0110.\n    CLEAR gv_after_0140.\n\n  ENDIF.\n\" ...\nFORM insert_multi_plan_item .\n\n  INSERT ztd3sd0005\n    FROM TABLE @gt_insert_item.\n\n  IF sy-subrc = 0.\n    COMMIT WORK.\n    \" 023 : 저장되었습니다.\n    MESSAGE s023.\n  ELSE.\n    ROLLBACK WORK.\n    \" 025 : 저장에 실패하였습니다.\n    MESSAGE s025 DISPLAY LIKE 'E'.\n  ENDIF.",
   "cap": "ZD3SD0008F01"
  }
 ],
 "sd/2": [
  {
   "h": "최대 조회 건수 검증",
   "d": "<code>AT SELECTION-SCREEN ON pa_mrow</code>에서 입력값을 검사. 음수는 기본값 100으로 복원, 3000건 초과는 3000건으로 강제하고, 1000건 이상이나 0(<code>UP TO 0 ROWS</code> = 무제한)은 조회 지연 경고만 표시.",
   "lang": "abap",
   "src": "FORM check_max_row .\n\n  IF pa_mrow LT 0.\n\n    pa_mrow = 100.\n    \" 017: 최대 조회 건수는 &1건 이하일 수 없습니다.\n    MESSAGE s017 DISPLAY LIKE 'E' WITH 0.\n\n  ELSEIF pa_mrow GE 1000 AND pa_mrow LE 3000.\n    \" 238 : 조회 건수가 많아 조회 시간이 지연될 수 있습니다.\n    MESSAGE i238 DISPLAY LIKE 'W'.\n\n  ELSEIF pa_mrow GT 3000.\n\n    pa_mrow = 3000.\n    \" 018: 최대 조회 건수는 &1건 초과일 수 없습니다.\n    MESSAGE i018 DISPLAY LIKE 'E' WITH 3000.\n\n  ENDIF.\n\n  IF pa_mrow EQ 0.\n    \"238: 조회 건수가 많아 조회 시간이 지연될 수 있습니다.\n    MESSAGE i238 DISPLAY LIKE 'W'.\n\n  ENDIF.\n\nENDFORM.",
   "cap": "ZRD3SD0007_F01"
  },
  {
   "h": "오더 유형별 조회: 서브쿼리로 이력 판별",
   "d": "일반 오더는 <code>type = 'N'</code>이면서 같은 판매오더에 다른 유형의 출고요청이 <code>NOT EXISTS</code>인 건만, 교환 오더는 같은 판매오더에 <code>type = 'E'</code> 출고요청이 <code>EXISTS</code>인 건을 조회. 번호 3번째 자리가 '8'인 문서는 <code>substring</code> 조건으로 제외하고 <code>UP TO @pa_mrow ROWS</code>로 건수 제한.",
   "lang": "abap",
   "src": "SELECT dlrno,\n       vbeln,\n       werks,\n       type,\n       wsdat,\n       wadat,\n       lfdat,\n       vsbed,\n       listat\n  FROM ztd3sd0008 AS a\n WHERE dlrno IN @so_dl\n   AND vbeln IN @so_po\n   AND wadat IN @so_wa\n   AND lfdat IN @so_lf\n   AND type  EQ 'N'\n   AND substring( dlrno, 3, 1 ) NE '8'\n   AND substring( vbeln, 3, 1 ) NE '8'\n   AND NOT EXISTS (\n       SELECT *\n         FROM ztd3sd0008 AS b\n        WHERE b~vbeln = a~vbeln\n          AND b~type  <> 'N'\n   )\n ORDER BY vbeln, dlrno\n  INTO CORRESPONDING FIELDS OF TABLE @gt_delivery\n    UP TO @pa_mrow ROWS.\n   \" ...\n   AND EXISTS (\n       SELECT *\n         FROM ztd3sd0008 AS b\n        WHERE b~vbeln = a~vbeln\n          AND b~type  = 'E'\n   )\n ORDER BY vbeln, dlrno\n  INTO CORRESPONDING FIELDS OF TABLE @gt_delivery\n    UP TO @pa_mrow ROWS.",
   "cap": "ZRD3SD0007_F01"
  },
  {
   "h": "출하 진행 상태 판정",
   "d": "실제 출고일(<code>wadat</code>)과 납기 일자(<code>lfdat</code>), 오늘 날짜를 비교해 상태 코드와 아이콘을 부여. 출고일이 없으면 승인 대기(N), 출고일만 있으면 배송 전(W), 납기 일자가 지났으면 출하 완료(E), 그 외 출고 이후는 출하 중(I).",
   "lang": "abap",
   "src": "FORM fill_status .\n\n  CLEAR gs_delivery-status.\n\n  \" 실제 출고일 필드가 비워져 있으면\n  IF gs_delivery-wadat IS INITIAL.\n\n    gs_delivery-status = 'N'.   \" 승인 대기\n    gs_delivery-icon   = icon_fast_entry.\n\n    \" 실제 출고일 필드가  MM의 입출고 승인으로 인해 채워지고,\n    \" 아직 납기일 일자가 비워져 있다면\n  ELSEIF gs_delivery-wadat IS NOT INITIAL AND gs_delivery-lfdat IS INITIAL.\n\n    gs_delivery-status = 'W'.   \" 배송 전\n    gs_delivery-icon   =     icon_pm_insert.\n\n    \" 실제 출고일 필드가  MM의 입출고 승인으로 인해 채워지고,\n    \" 오늘 날짜보다 납기 일자와 같거나 크다면 : 배송 완료라면\n  ELSEIF gs_delivery-wadat IS NOT INITIAL AND gs_delivery-lfdat IS NOT INITIAL AND sy-datum GE gs_delivery-lfdat.\n\n    gs_delivery-status = 'E'.   \" 배송 완료\n    gs_delivery-icon   = icon_visit.\n\n    \" 실제 출고일 필드가  MM의 입출고 승인으로 인해 채워지고,\n    \" 납기 일자가 오늘 날짜보다 크다면 : 아직 배송 완료가 아니라면\n    \" 납기 예정 >\n  ELSEIF gs_delivery-wadat IS NOT INITIAL AND gs_delivery-wadat LT sy-datum.\n\n    gs_delivery-status = 'I'.   \" 배송 중\n    gs_delivery-icon   = icon_delivery.\n\n  ENDIF.\n\nENDFORM.",
   "cap": "ZRD3SD0007_F01"
  },
  {
   "h": "헤더 데이터 가공과 도메인 텍스트",
   "d": "조회한 출고요청 헤더를 한 번 순회하며 플랜트명 · 상태 · 유형/배송조건/출고요청 상태 텍스트 · 정렬키를 채움. 텍스트는 <code>DD_DOMVALUES_GET</code>으로 도메인 고정값 설명(<code>ZDD3_SD_LITYPE</code>, <code>ZDD3_SD_VSBED</code>, <code>ZDD3_SD_LISTAT</code>)을 가져와 매핑.",
   "lang": "abap",
   "src": "FORM modify_data .\n\n  LOOP AT gt_delivery INTO gs_delivery.\n    \" 플랜트명 필드 채우기\n    PERFORM fill_wetxt.\n\n    \" 배송상태 필드 채우기\n    PERFORM fill_status.\n\n    \" 출고요청 타입 텍스트 필드 채우기\n    PERFORM fill_tytxt.\n\n    \" 배송 타입 텍스트 필드 채우기\n    PERFORM fill_vstxt.\n\n    \" 출고요청 상태 텍스트 필드 채우기\n    PERFORM fill_litxt.\n\n    \" 출고 유형에 따른 Sort 하기 위한 로직\n    PERFORM fill_sort_type.\n\n    MODIFY gt_delivery FROM gs_delivery.\n\n  ENDLOOP.\n\n  SORT gt_delivery BY vbeln type_sort.\n\nENDFORM.\n  \" ...\n  \" Fixed Value의 Discription 가져오는 Function\n  CALL FUNCTION 'DD_DOMVALUES_GET'\n    EXPORTING\n      domname   = 'ZDD3_SD_LITYPE'\n      text      = 'X'\n      langu     = sy-langu\n    TABLES\n      dd07v_tab = lt_dom\n    EXCEPTIONS\n      OTHERS    = 1.\n\n  READ TABLE lt_dom INTO ls_dom WITH KEY domvalue_l = gs_delivery-type.\n\n  gs_delivery-tytxt = ls_dom-ddtext.",
   "cap": "ZRD3SD0007_F01"
  },
  {
   "h": "ALV 툴바 상태 필터",
   "d": "<code>toolbar</code> 이벤트로 추가한 버튼의 function code를 상태 코드로 바꿔 <code>set_filter_criteria</code>로 <code>STATUS</code> 필드 필터를 적용. 하단 아이템 ALV는 비우고, 필터 건수를 세어 헤더 ALV 제목을 갱신.",
   "lang": "abap",
   "src": "FORM filter_item  USING    po_ucomm.\n\n  CASE po_ucomm.\n    WHEN 'ALL'.\n      PERFORM clear_filter.\n    WHEN 'NOT_APPR'.\n      PERFORM set_filter USING 'N'.\n    WHEN 'WILL'.\n      PERFORM set_filter USING 'W'.\n    WHEN 'ING'.\n      PERFORM set_filter USING 'I'.\n    WHEN 'END'.\n      PERFORM set_filter USING 'E'.\n  ENDCASE.\n\nENDFORM.\n  \" ...\n  ls_filter-fieldname = 'STATUS'.\n  ls_filter-sign      = 'I'.\n  ls_filter-option    = 'EQ'.\n  ls_filter-low       = pv_type.\n  APPEND ls_filter TO lt_filter.\n\n  CALL METHOD go_alv_grid->set_filter_criteria\n    EXPORTING\n      it_filter = lt_filter.\n\n  REFRESH gt_detail.\n  CLEAR gv_alv_title2.\n\n  LOOP AT gt_display INTO gs_display WHERE status EQ pv_type.\n\n    lv_count += 1.\n\n  ENDLOOP.\n\n  IF gs_display-status EQ 'N'.\n    gv_alv_title1 = |승인 대기 딜리버리 목록({ lv_count })|.\n  ELSEIF gs_display-status EQ 'I'.\n    gv_alv_title1 = |출하중 딜리버리 목록({ lv_count })|.\n  ELSEIF gs_display-status EQ 'E'.\n    gv_alv_title1 = |출하 완료 딜리버리 목록({ lv_count })|.\n  ENDIF.",
   "cap": "ZRD3SD0007_F01"
  },
  {
   "h": "헤더 더블클릭 → 아이템 조회",
   "d": "<code>double_click</code> 이벤트에서 선택 행을 읽어 아이템 조회 · 선택 행 색상(<code>C500</code>) · 자재명 보완(<code>ztd3mm0001</code>) 순으로 처리. 아이템은 출고요청 헤더와 조인해 선택 행과 같은 판매오더(<code>vbeln</code>)의 출고요청 아이템 전체를 가져옴.",
   "lang": "abap",
   "src": "FORM handle_double_click     USING    po_row      TYPE lvc_s_row\n                                      po_column   TYPE lvc_s_col\n                                      p_roid      TYPE lvc_s_roid.\n\n  CLEAR gs_display.\n\n  READ TABLE gt_display INTO gs_display INDEX po_row-index.\n\n  \" 딜리버리 오더 아이템 조회\n  PERFORM select_delivery_item USING po_row\n                                     po_column.\n\n  \" 선택한 행 컬러 처리\n  PERFORM set_selected_color   USING po_row\n                                     po_column\n                                     p_roid.\n\n  \" 데이터 가공\n  PERFORM modify_item_data     USING po_row\n                                     po_column.\n\n  MOVE-CORRESPONDING gt_delivery_item TO gt_detail.\n\n  PERFORM refresh_alv_0100.\n  \" ...\n  SELECT a~dlrno,\n         a~posnr,\n         a~matnr,\n         a~lfimg,\n         a~kwmeng,\n         a~meins\n    FROM ztd3sd0009       AS a\n   INNER JOIN ztd3sd0008 AS b\n      ON a~dlrno EQ b~dlrno\n   WHERE b~vbeln EQ @gs_display-vbeln\n    INTO CORRESPONDING FIELDS OF TABLE @gt_delivery_item.\n\n    lv_count = lines( gt_delivery_item ).\n\n    gv_alv_title2 = | 딜리버리 아이템 목록({ lv_count })|.",
   "cap": "ZRD3SD0007_F01"
  },
  {
   "h": "상단 조회 조건 영역(docking container)",
   "d": "화면 상단에 <code>cl_gui_docking_container</code>를 한 번만 생성하고 <code>cl_dd_document</code>에 조회 조건 HTML을 넣어 표시. 툴바 <code>SHOW_HIDE</code> 버튼으로 <code>set_visible</code>을 토글해 조건 영역을 접고 펼침.",
   "lang": "abap",
   "src": "FORM display_search_condition .\n\n*--------------------------------------------------------------------*\n* 상단에 docking container, doc 생성\n*--------------------------------------------------------------------*\n  IF go_dock_top IS INITIAL.\n    CREATE OBJECT go_dock_top\n      EXPORTING\n        repid     = sy-repid \" REPORT TO WHICH THIS DOCKING CONTROL IS LINKED\n        dynnr     = sy-dynnr \" SCREEN TO WHICH THIS DOCKING CONTROL IS LINKED\n        side      = cl_gui_docking_container=>dock_at_top\n        extension = 65               \" Control Extension\n      EXCEPTIONS\n        OTHERS    = 1.\n    IF sy-subrc <> 0.\n      MESSAGE e019. \" 019: &1 Docking Container 생성에 실패하였습니다.\n    ENDIF.\n\n    CREATE OBJECT go_doc\n      EXPORTING\n        style      = 'ALV_GRID'\n        no_margins = 'X'.\n  ENDIF.\n\n  PERFORM set_document_data_0100.\n\nENDFORM.\n  \" ...\n  IF go_dock_top IS BOUND. \" 컨테이너 객체가 생성되어 있다면\n    CALL METHOD go_dock_top->set_visible\n      EXPORTING\n        visible = gv_dock_state.\n  ENDIF.",
   "cap": "ZRD3SD0007_F01"
  }
 ],
 "sd/3": [
  {
   "h": "CDS 기반 청구 대상 조회 · 최대 조회 건수 제한",
   "d": "승인된 판매오더와 출고요청 정보를 묶은 CDS <code>ZCDS_D3_SD_0010</code>에서 조회 조건으로 대상 건을 가져오고, 회사코드 · 출고요청 유형은 미입력 시 조건에서 제외. 범위 조건은 사전에 <code>MIN( )</code> / <code>MAX( )</code>로 채워 <code>BETWEEN</code> 한 가지 형태로 처리하고, <code>UP TO @gv_mrow ROWS</code>로 최대 조회 건수 제한.",
   "lang": "abap",
   "src": "REFRESH gt_display1.\n\nCHECK gv_lfdat_valid IS INITIAL.\n\n\" 판매오더 승인 상태인 데이터만 가져온다.\nSELECT FROM zcds_d3_sd_0010\n  FIELDS\n    bukrs,\n    vbeln,\n    kunnr,\n    vbeln_so,\n    butxt,\n    repnm,\n    vkorg,\n    netwr,\n    gross_so,\n    lfdat,\n    audat,\n    waers,\n    zterm,\n    type,\n    wsdat,\n    wadat\n  WHERE ( bukrs = @gv_bukrs OR @gv_bukrs IS INITIAL )\n    AND ( type  = @gv_type  OR @gv_type  IS INITIAL )\n    AND kunnr    BETWEEN @gv_ku_from AND @gv_ku_to\n    AND vbeln_so BETWEEN @gv_vb_from AND @gv_vb_to\n    AND audat    BETWEEN @gv_au_from AND @gv_au_to\n    AND lfdat    BETWEEN @gv_lf_from AND @gv_lf_to\n   INTO CORRESPONDING FIELDS OF TABLE @gt_delivery_header\n  UP TO @gv_mrow ROWS.\n\nlv_lines = lines( gt_delivery_header ).\n\nIF lv_lines EQ 0.\n  gv_no_data = abap_true.\n  \" 조회된 데이터가 0건 입니다.\n  MESSAGE s052 DISPLAY LIKE 'A'.\nENDIF.\n\ngv_alv_title = | 대금청구 목록 ({ lv_lines }) |.",
   "cap": "ZD3SD0009F01"
  },
  {
   "h": "청구 상태 판정 (DB 청구 완료 / ITAB 생성 대기 / 미청구)",
   "d": "대금청구 헤더 <code>ZTD3SD0010</code>에 판매오더가 있으면 청구 완료(초록불), DB에는 없지만 이번 세션에서 생성한 <code>gt_bill_header</code>에 있으면 저장 대기(<code>icon_change_text</code>), 둘 다 없으면 미청구(노란불). 미청구 건에만 <code>mc_style_button</code> 셀 버튼 '청구생성' 부여.",
   "lang": "abap",
   "src": "SELECT vbeln_so\n  FROM ztd3sd0010\n  INTO CORRESPONDING FIELDS OF TABLE @lt_bill_db.\n\n\" 1. DB에 이미 청구된 건 확인\nCLEAR ls_bill_db.\nREAD TABLE lt_bill_db INTO ls_bill_db\n  WITH KEY vbeln_so = gs_delivery_header-vbeln_so.\n\nIF sy-subrc = 0.\n  gs_delivery_header-status = icon_led_green.\n  RETURN.\nENDIF.\n\n\" 2. DB에는 없지만, 현재 ITAB에만 생성된 청구 건 확인\nCLEAR ls_bill_itab.\nREAD TABLE gt_bill_header INTO ls_bill_itab\n  WITH KEY vbeln_so = gs_delivery_header-vbeln_so.\n\nIF sy-subrc = 0.\n  \" 있으면\n  gs_delivery_header-status = icon_change_text.\nELSE.\n  \" 없으면\n  gs_delivery_header-status = icon_led_yellow.\nENDIF.",
   "cap": "ZD3SD0009F01"
  },
  {
   "h": "견적 시점 대비 가격 변동 체크 후 확인 팝업",
   "d": "견적일~청구일 사이의 가격 변동 이력을 조인한 CDS <code>ZCDS_D3_SD_0024</code>(견적 헤더/아이템 · 판매오더 아이템 · 가격 이력 <code>ZTD3SD0016</code>, 미청구 건만)를 판매오더 아이템별로 조회해 한 건이라도 있으면 플래그 설정, 청구 확인 팝업 문구를 '가격 변동 확인'으로 전환.",
   "lang": "abap",
   "src": "CLEAR gv_price_change.\n\nLOOP AT gt_delivery_item INTO gs_delivery_item.\n\n  \" 가격 변동 이력 테이블의 생성일자와 견적 당시의 일자 비교해서 데이터가 있는지 확인\n  \" 없으면 가격 변동 X, 있으면 가격 변동된것임\n  SELECT SINGLE Bill\n    FROM zcds_d3_sd_0024\n   WHERE Vbein_so = @gs_delivery_item-vbeln\n    INTO @DATA(lv_vbeln).\n\n  IF sy-subrc EQ 0.\n\n    gv_price_change = abap_on.\n\n  ENDIF.\n\nENDLOOP.\n\" ...\n  WHEN 'CRE_BILL'.\n    IF gv_price_change IS NOT INITIAL.\n      lv_title    = '가격 변동 확인'.\n      lv_question = '청구 과정에서 해당 제품에 대한 가격이 변동되었습니다. 청구 하시겠습니까?'.\n      CLEAR gv_price_change.\n    ELSE.\n      lv_title    = '청구 확인'.\n      lv_question = '청구 하시겠습니까?'.\n    ENDIF.",
   "cap": "ZD3SD0009F01"
  },
  {
   "h": "저장 전 동일 판매오더 검증 · 대금청구 헤더/아이템 INSERT (오류 시 ROLLBACK)",
   "d": "청구 생성 단계에서 Number Range <code>ZNRD3SD10</code>으로 채번한 <code>BO</code> + 8자리 번호로 헤더/아이템을 ITAB에 쌓아 두고, 저장 시 확인 팝업 · 저장 데이터 존재 · 생성 여부 플래그를 <code>CHECK</code>로 확인. 저장할 헤더의 판매오더가 이미 <code>ZTD3SD0010</code>에 있으면 저장 중단, 없으면 대금청구 헤더 <code>ZTD3SD0010</code> · 아이템 <code>ZTD3SD0011</code>을 <code>INSERT … FROM TABLE</code>로 저장하고 실패 시 <code>ROLLBACK WORK</code>.",
   "lang": "abap",
   "src": "\" 팝업 확인을 눌렀을 때 실행\nCHECK gv_ok IS NOT INITIAL.\n\n\" 저장할 데이터가 있을 때 실행(팝업을 위해)\nCHECK gv_not_initail IS NOT INITIAL.\n\n\" 저장할 데이터가 있을 때 실행(저장을 위해)\nCHECK gv_save_bool IS NOT INITIAL.\n\nCLEAR gv_save_bool.\nCLEAR gv_ok.\n\nLOOP AT gt_bill_header INTO gs_bill_header.\n\n  CLEAR lv_vbeln_so.\n\n  SELECT SINGLE vbeln_so\n    FROM ztd3sd0010\n   WHERE vbeln_so EQ @gs_bill_header-vbeln_so\n    INTO @lv_vbeln_so.\n\n  IF lv_vbeln_so IS NOT INITIAL.\n    lv_count += 1.\n  ENDIF.\n\nENDLOOP.\n\n\" 대금청구에 해당하는 판매오더가 있으면 돌아가기\nIF lv_vbeln_so NE 0.\n\n  \" 106 : 해당 판매오더가 이미 존재합니다. 다시 한번 확인해주세요.\n  MESSAGE s106 DISPLAY LIKE 'A'.\n  EXIT.\n\nELSE.\n\n  \" 대금청구 헤더 저장\n  INSERT ztd3sd0010 FROM TABLE @gt_bill_header.\n  IF sy-subrc <> 0.\n    ROLLBACK WORK.\n    \" 저장에 실패하였습니다.\n    MESSAGE s025 DISPLAY LIKE 'A'.\n    EXIT.\n  ENDIF.\n\n  \" 대금청구 아이템 저장\n  INSERT ztd3sd0011 FROM TABLE @gt_bill_item.\n  IF sy-subrc <> 0.\n    ROLLBACK WORK.\n    \" 저장에 실패하였습니다.\n    MESSAGE s025 DISPLAY LIKE 'A'.\n    EXIT.\n  ENDIF.",
   "cap": "ZD3SD0009F01"
  },
  {
   "h": "매출 전표 생성 Function 호출",
   "d": "청구 생성 시 쌓아 둔 <code>gt_statement</code>(회사코드 · 전기일 · 증빙일 · 고객 · 총액 · 세금코드 · 지급조건 · 판매오더)를 건별로 전표 자동 생성 Function <code>ZFD3FI0005</code>에 전달, 여러 건 청구에 대비해 LOOP 처리.",
   "lang": "abap",
   "src": "LOOP AT gt_statement INTO gs_statement.\n\n  call function 'ZFD3FI0005'\n    EXPORTING\n      iv_bukrs = gs_statement-bukrs      \" 회사코드\n      iv_budat = gs_statement-budat      \" 전기일\n      iv_bldat = gs_statement-bldat      \" 증빙일\n      iv_kunnr = gs_statement-kunnr      \" 고객코드\n      iv_wrbtr = gs_statement-wrbtr      \" 총액(고객에게 청구할 금액)\n      iv_waers = gs_statement-waers      \" 통화코드\n      iv_mwskz = gs_statement-mwskz      \" 세금코드(A1-매출부가세 10%)\n      iv_zterm = gs_statement-zterm      \" 지급조건\n      iv_vbeln = gs_statement-vbeln    \" 판매오더번호\n    IMPORTING\n      \"ev_belnr =                           \" 전표번호\n      ev_msg   = lv_num.                   \" 전표 생성 결과 전달.\n\n  IF sy-subrc <> 0.\n    ROLLBACK WORK.\n    \" 저장에 실패하였습니다.\n    MESSAGE s025 DISPLAY LIKE 'A'.\n    EXIT.\n  ENDIF.\n\nENDLOOP.",
   "cap": "ZD3SD0009F01"
  },
  {
   "h": "ZFD3FI0005: 외상매출금 / 제품매출 / 매출부가세 분개 · 차대 검증",
   "d": "전표유형 <code>RV</code>, Number Range <code>ZNRD3FI01</code>로 전표번호를 채번하고 차변 외상매출금(전기키 <code>1</code>, <code>0000110000</code>), 대변 제품매출(전기키 <code>50</code>, <code>0000400000</code>) · 매출부가세(전기키 <code>50</code>, <code>0000240000</code>) 3개 라인 생성. 총액을 1.1로 나눠 공급가액 · 세액을 역산하고, 차변 합계와 대변 합계가 다르면 전기 중단 후 전표 헤더 <code>ZTD3FI0003</code> · 아이템 <code>ZTD3FI0004</code> 저장.",
   "lang": "abap",
   "src": "* 3-1. 차변(S) - 외상매출금(자산) 증가\nCLEAR ls_item.\nls_item-bukrs    = iv_bukrs.                    \" 회사코드\nls_item-gjahr    = iv_budat+0(4).               \" 회계연도\nls_item-belnr    = lv_belnr.                    \" 전표번호\nls_item-buzei    = '010'.                       \" 항목번호\nls_item-bschl    = '1'.                         \" 전기키(1 : 고객 차변 (매출채권 발생))\nls_item-shkzg    = 'S'.                         \" 차대변지시자(S : 차변)\nls_item-hkont    = '0000110000'.                \" G/L 계정(0000110000 : 외상매출금)\nls_item-koart    = 'D'.                         \" 계정유형 ( S : G/L, M : 자재, D : 고객, K : 공급업체)\nls_item-kunnr    = iv_kunnr.                    \" 고객코드\nls_item-wrbtr    = iv_wrbtr.                    \" 거래 통화금액\n\" ...\n* 3-2. 대변(H) - 제품매출(수익) 발생 - 세금코드/공급가액/세액 입력 필수\n\n\" 외상매출금 기준 공급가액 / 세액(매출부가세) 역산\n\" 공급가액 = 외상매출금 / 1.1\n\" 세액     = 외상매출금 - 공급가액\nDATA: lv_supply_amt TYPE p LENGTH 8 DECIMALS 4,   \" 공급가액\n      lv_tax_amt    TYPE p LENGTH 8 DECIMALS 4.   \" 매출부가세\n\nlv_supply_amt = round( val = iv_wrbtr / '1.1'\n                       dec = 0 ).\nlv_tax_amt    = iv_wrbtr - lv_supply_amt.\n\" ...\nls_item-buzei    = '020'.                       \" 항목번호\nls_item-bschl    = '50'.                        \" 전기키(50 : G/L 대변)\nls_item-shkzg    = 'H'.                         \" 차대변지시자(H : 대변)\nls_item-hkont    = '0000400000'.                \" G/L 계정(0000400000 : 제품매출)\nls_item-koart    = 'S'.                         \" 계정유형 ( S : G/L, M : 자재, D : 고객, K : 공급업체)\nls_item-wrbtr    = lv_supply_amt.               \" 거래 통화금액(공급가액)\n\" ...\nls_item-buzei    = '030'.                       \" 항목번호\nls_item-bschl    = '50'.                        \" 전기키(50 : G/L 대변)\nls_item-shkzg    = 'H'.                         \" 차대변지시자(H : 대변)\nls_item-hkont    = '0000240000'.                \" G/L 계정(0000240000 : 매출부가세(예수금))\nls_item-koart    = 'S'.                         \" 계정유형 ( S : G/L, M : 자재, D : 고객, K : 공급업체)\nls_item-wrbtr    = lv_tax_amt.                  \" 거래 통화금액(세액)\n\" ...\nLOOP AT lt_item INTO ls_item.\n  CASE ls_item-shkzg.\n    WHEN 'S'. \" 차변\n      lv_debit += ls_item-dmbtr.\n    WHEN 'H'. \" 대변\n      lv_credit += ls_item-dmbtr.\n  ENDCASE.\nENDLOOP.\n\nIF lv_debit IS INITIAL OR lv_credit IS INITIAL.\n  \" e10 : 차변 또는 대변 금액이 없습니다.\n  ev_msg = TEXT-e10.\n  RETURN.\nENDIF.\n\nIF lv_debit NE lv_credit.\n  \" e11 : 차변과 대변의 금액이 일치하지 않습니다.\n  ev_msg = TEXT-e11.\n  RETURN.\nENDIF.",
   "cap": "ZFD3FI0005"
  },
  {
   "h": "세금계산서 헤더/아이템 저장 · COMMIT · ITAB REFRESH",
   "d": "전표 생성 후 <code>ZTD3FI0004</code>에서 전기키 <code>1</code> 라인의 전표번호를 찾아 세금계산서 헤더(Number Range <code>ZNRD3FI13</code>, <code>TX</code> + 8자리)에 연결하고, 세금계산서 헤더 <code>ZTD3FI0013</code> · 아이템 <code>ZTD3FI0014</code> 저장(실패 시 <code>ROLLBACK WORK</code>) 후 <code>COMMIT WORK</code>. 저장 직후 관련 ITAB을 모두 <code>REFRESH</code>해 저장 버튼 중복 클릭에 의한 중복 저장 방지.",
   "lang": "abap",
   "src": "\" 전표 생성 로직\nPERFORM set_statement.\n\n\" 세금계산서 전표번호 세팅\nPERFORM set_gt_tax_belnr.\n\n\" 세금계산서 헤더 저장\nINSERT ztd3fi0013 FROM TABLE @gt_tax_header.\nIF sy-subrc <> 0.\n  ROLLBACK WORK.\n  \" 저장에 실패하였습니다.\n  MESSAGE s025 DISPLAY LIKE 'A'.\n  EXIT.\nENDIF.\n\n\" 세금계산서 아이템 저장\nINSERT ztd3fi0014 FROM TABLE @gt_tax_item.\nIF sy-subrc <> 0.\n  ROLLBACK WORK.\n  \" 저장에 실패하였습니다.\n  MESSAGE s025 DISPLAY LIKE 'A'.\n  EXIT.\nENDIF.\n\nCOMMIT WORK.\n\nMESSAGE s023. \" 저장되었습니다.\n\n\" 저장 버튼을 누른 후, 여러 번 누르는 것을 막기 위한 클리어\nREFRESH gt_statement.\nREFRESH gt_bill_header.\nREFRESH gt_bill_item.\nREFRESH gt_tax_header.\nREFRESH gt_tax_item.\n\n\" 다시 데이터 재조회 하기 위해\nCLEAR gv_start.",
   "cap": "ZD3SD0009F01"
  },
  {
   "h": "SUBMIT … WITH로 대금청구 조회 프로그램 연계",
   "d": "ALV에서 선택한 행이 정확히 1건인지 확인하고, 대금청구 번호가 없는 미청구 건은 차단. 청구 완료 건은 <code>SUBMIT zrd3sd0010 … AND RETURN</code>으로 대금청구 번호를 Select-Option에 넘기고 <code>pa_auto</code>로 자동 조회까지 실행한 뒤 원래 화면으로 복귀.",
   "lang": "abap",
   "src": "CALL METHOD go_alv_grid->get_selected_rows\n  IMPORTING\n    et_index_rows = lt_rows.\n\nIF lines( lt_rows ) GT 1.\n  \" 데이터를 1건만 선택해 주세요\n  MESSAGE s079 DISPLAY LIKE 'W'.\n  RETURN.\nELSEIF lines( lt_rows ) EQ 0.\n  \" 데이터를 선택해 주세요\n  MESSAGE s080 DISPLAY LIKE 'W'.\n  RETURN.\nENDIF.\n\nREAD TABLE lt_rows INTO ls_row INDEX 1.\n\nREAD TABLE gt_display1 INTO gs_display1 INDEX ls_row-index.\n\nIF gs_display1-vbeln IS INITIAL.\n  \" 아직 청구되지 않은 건입니다.\n  MESSAGE s086 DISPLAY LIKE 'A'.\n  RETURN.\nENDIF.\n\nSUBMIT zrd3sd0010\n  WITH so_vb        = gs_display1-vbeln\n  WITH so_vb-sign   = 'I'\n  WITH so_vb-option = 'EQ'\n  WITH pa_auto   = abap_true\n   AND RETURN.",
   "cap": "ZD3SD0009F01"
  }
 ],
 "sd/4": [
  {
   "h": "대금청구 헤더 조회",
   "d": "고객 마스터(<code>ztd3sd0001</code>)와 대금청구 헤더(<code>ztd3sd0010</code>)를 조인해 고객명 · 대표자명까지 한 번에 조회. 번호 3번째 자리가 '8'인 문서는 제외하고, 실제 조회 건수가 최대 조회 건수보다 적으면 <code>pa_mrow</code>를 실제 건수로 맞춰 ALV 제목에 사용.",
   "lang": "abap",
   "src": "SELECT b~vbeln,\n    b~bukrs,\n    b~kunnr,\n    a~butxt,\n    a~repnm,\n    b~vbeln_so,\n    b~dlrno,\n    b~fkdat,\n    b~re_date,\n    b~vkorg,\n    b~netwr,\n    b~gross,\n    b~waers,\n    b~zterm,\n    b~vbstat\nFROM ztd3sd0001 AS a INNER JOIN ztd3sd0010 AS b\nON a~kunnr EQ b~kunnr\nWHERE b~vbeln  IN @so_vb\n  AND substring( b~vbeln, 3, 1 ) NE '8'\nAND b~vbeln_so IN @so_vs\nAND b~dlrno    IN @so_vd\nAND b~bukrs    IN @so_bu\nAND b~kunnr    IN @so_cu\nAND b~fkdat    IN @so_bd\nINTO CORRESPONDING FIELDS OF TABLE @gt_billing\nUP TO @pa_mrow ROWS.\n\n\" 1000번 스크린에서 입력한 조회 조건 개수보다 실제 검색된 데이터가 더 적을 때\nIF pa_mrow GT lines( gt_billing ).\n  pa_mrow = lines( gt_billing ).\nENDIF.\n\nSORT gt_billing BY fkdat kunnr.\n\nIF gt_billing IS INITIAL.\n  gv_no_data = abap_true.\n  \" 052 : 조회된 데이터가 0건 입니다.\n  MESSAGE s052 DISPLAY LIKE 'A'.\nENDIF.\n\ngv_alv_title = | { TEXT-t02 } ({ pa_mrow NUMBER = USER })건 |. \" t02: 대금청구 목록",
   "cap": "ZRD3SD0010_F01"
  },
  {
   "h": "전표 Line Item 기반 수금 금액 집계",
   "d": "회계 전표 아이템(<code>ztd3fi0004</code>)을 대금청구의 판매오더 번호로 조인해 미리 읽어 두고, 대금청구별로 계정유형 <code>D</code>(고객) 라인 중 전기키 01은 발생 채권, 11은 입금/반제로 합산. 미수 잔액은 차액으로 계산하고 음수는 0으로 보정.",
   "lang": "abap",
   "src": " SELECT koart,      \" 계정유형\n        bschl,      \" 전기키\n        a~kunnr,    \" 고객코드\n        wrbtr,      \" 거래 통화금액\n        belnr,      \" 전표번호\n        due_date,   \" 순액 만기일\n        a~waers,    \" 통화코드\n        a~vbeln     \" 발생 전표번호\n FROM ztd3fi0004 AS a\nINNER JOIN ztd3sd0010 AS b ON a~vbeln = b~vbeln_so\nORDER BY a~belnr\n INTO CORRESPONDING FIELDS OF TABLE @gt_statement.\n \" ...\n LOOP AT gt_statement INTO gs_statement\n   WHERE vbeln EQ gs_billing-vbeln_so.\n\n   \" 고객 채권 발생 라인 (고객 차변)\n   \" 전기키 마스터 기준: 01 = 고객 차변(매출채권 발생)\n   IF gs_statement-koart = 'D'\n      AND gs_statement-bschl = 1.\n\n     lv_ar_amt += gs_statement-wrbtr.\n\n   ENDIF.\n\n   \" 고객 입금/반제 라인 (고객 대변)\n   \" 전기키 마스터 기준: 11 = 고객 대변(입금/반제)\n   IF gs_statement-koart = 'D'\n      AND gs_statement-bschl = 11.\n\n     lv_clr_amt += gs_statement-wrbtr.\n\n   ENDIF.\n\n   \" 미수잔액 계산\n   lv_rem_amt = lv_ar_amt - lv_clr_amt.\n   IF lv_rem_amt < 0.\n     lv_rem_amt = 0.\n   ENDIF.\n\n   gs_billing-get_price = lv_clr_amt.    \" 받은 금액 세팅\n   gs_billing-ng_price  = lv_rem_amt.    \" 미수 금액 세팅\n\n   CHECK gs_billing-re_date LT sy-datum.",
   "cap": "ZRD3SD0010_F01"
  },
  {
   "h": "수금 상태 아이콘 규칙",
   "d": "만기일(<code>re_date</code>)이 지난 건만 잔액 기준으로 A(전액 수금) · B(일부 수금) · C(미수금)를 판정하고, 만기일 미도래 건은 D로 덮어써 달력 아이콘을 표시.",
   "lang": "abap",
   "src": "FORM set_status .\n\n  DATA : lv_rule TYPE c.\n\n  \" 만기일 지난 거래\n  PERFORM set_icon_rule  USING lv_rule.\n  \" 만기일 지나지 않은 거래\n  PERFORM set_icon_rule2 USING lv_rule.\n\n  CASE lv_rule.\n    WHEN 'A'.\n      gs_billing-status = icon_led_green.\n    WHEN 'B'.\n      gs_billing-status = icon_led_yellow.\n    WHEN 'C'.\n      gs_billing-status = icon_led_red.\n    WHEN 'D'.\n      gs_billing-status = icon_date.\n  ENDCASE.\n    \" ...\n    \" 전체 수금 시\n    IF lv_rem_amt EQ 0.\n      pv_rule = 'A'.\n      \" 일부 수금 시\n    ELSEIF lv_rem_amt NE 0 AND lv_rem_amt LT lv_ar_amt.\n      pv_rule = 'B'.\n      \" 미수금 시\n    ELSEIF lv_rem_amt EQ lv_ar_amt.\n      pv_rule = 'C'.\n      .\n    ENDIF.\n  \" ...\n  CHECK gs_billing-re_date GE sy-datum.\n\n  pv_rule = 'D'.",
   "cap": "ZRD3SD0010_F01"
  },
  {
   "h": "툴바 명령과 상태 필터",
   "d": "<code>user_command</code> 이벤트에서 최대 조회 건수 변경(<code>SHOW_ROW</code>)과 상태 필터를 분기. 필터는 아이콘 값으로 <code>STATUS</code> 컬럼에 <code>set_filter_criteria</code>를 걸고 해당 건수를 세어 제목을 갱신.",
   "lang": "abap",
   "src": "CASE pv_ucomm.\n  WHEN 'SHOW_ROW'.\n    PERFORM set_show_row.\n    \" 전체 조회\n  WHEN 'ALL'.\n    PERFORM clear_filter.\n    \" 미수 조회\n  WHEN 'NO_RE'.\n    lv_status = icon_led_red.\n    PERFORM set_filter USING lv_status.\n    \" 일부 반제 조회\n  WHEN 'SH_RE'.\n    lv_status = icon_led_yellow.\n    PERFORM set_filter USING lv_status.\n    \" 전체 반제 조회\n  WHEN 'CL_RE'.\n    lv_status = icon_led_green.\n    PERFORM set_filter USING lv_status.\n    \" 미도래 조회\n  WHEN 'LT_RE'.\n    lv_status = icon_date.\n    PERFORM set_filter USING lv_status.\n\" ...\nls_filter-fieldname = 'STATUS'.\nls_filter-sign      = 'I'.\nls_filter-option    = 'EQ'.\nls_filter-low       =  pv_status.\nAPPEND ls_filter TO lt_filter.\n\nCALL METHOD go_alv_grid->set_filter_criteria\n  EXPORTING\n    it_filter = lt_filter.\n\nls_stbl-row = abap_true.\nls_stbl-col = abap_true.\n\n\" 필터링 건수 계산\nLOOP AT gt_display INTO gs_display\n     WHERE status EQ pv_status.\n\n  lv_count = lv_count + 1.\n\nENDLOOP.\n\ngv_alv_title = | { TEXT-t02 } ({ lv_count NUMBER = USER })건 |. \" t02: 대금청구 목록",
   "cap": "ZRD3SD0010_F01"
  },
  {
   "h": "핫스팟 컬럼별 연계 조회",
   "d": "<code>hotspot_click</code> 이벤트에서 클릭한 컬럼명으로 분기해 판매오더(<code>ztd3sd0006</code>) · 출고요청(<code>ztd3sd0008</code>) · 회계 전표 팝업 화면(0120 · 0130 · 0110)을 호출.",
   "lang": "abap",
   "src": "FORM handle_hotspot_click  USING    p_row_id    TYPE lvc_s_row\n                                    p_column_id TYPE lvc_s_col.\n\n  READ TABLE gt_display INTO gs_display INDEX p_row_id-index.\n\n* 출력용 ITAB에서 선택한 행에 대한 정보를 찾지 못할 경우 중단한다.\n  IF sy-subrc NE 0.\n    RETURN.\n  ENDIF.\n\n* 선택한 컬럼명의 필드명에 따라 로직을 구현한다.\n  CASE p_column_id-fieldname.\n    WHEN 'VBELN_SO'.\n      PERFORM select_so        USING p_row_id\n                                     p_column_id.\n\n    WHEN 'DLRNO'. \" 대금청구번호\n      PERFORM select_do        USING p_row_id\n                                     p_column_id.\n\n    WHEN 'VBELN'.\n      \" 전표 조회\n      PERFORM select_statement USING p_row_id\n                                     p_column_id.\n\n      CALL SCREEN 0110 STARTING AT 10 10 ENDING AT 135 23.\n\n  ENDCASE.\n\nENDFORM.",
   "cap": "ZRD3SD0010_F01"
  },
  {
   "h": "발생 전표 팝업: 수금 여부와 연체 일수",
   "d": "선택한 대금청구의 청구/수금 금액으로 수금 여부 라디오 버튼(<code>b1</code>~<code>b3</code>)을 세팅. 연체 일수는 <code>DATE_CONVERT_TO_FACTORYDATE</code>로 만기일과 오늘을 공장 달력 <code>KR</code> 영업일 번호로 바꿔 차이를 구하고, 미수 잔액이 남아 있을 때만 '연체 (D + n)' 또는 '순액만기일 미도래'로 표시.",
   "lang": "abap",
   "src": "\" 지급상태 라디오버튼\nCLEAR: b1, b2, b3.\n\nIF lv_ar_amt > 0 AND lv_clr_amt = 0.\n  b1 = 'X'.   \" 미지급\nELSEIF lv_ar_amt > lv_clr_amt AND lv_clr_amt > 0.\n  b2 = 'X'.   \" 일부 지급\nELSEIF lv_ar_amt > 0 AND lv_clr_amt >= lv_ar_amt.\n  b3 = 'X'.   \" 전액 지급\nENDIF.\n\" ...\n\" 영업일 번호 세팅\nCALL FUNCTION 'DATE_CONVERT_TO_FACTORYDATE'\n  EXPORTING\n    date                = gv_duedt\n    factory_calendar_id = 'KR'\n  IMPORTING\n    factorydate         = lv_fact_due.\n\n\" 영업일 번호 세팅\nCALL FUNCTION 'DATE_CONVERT_TO_FACTORYDATE'\n  EXPORTING\n    date                = sy-datum\n    factory_calendar_id = 'KR'\n  IMPORTING\n    factorydate         = lv_fact_today.\n\nlv_days = lv_fact_today - lv_fact_due.\n\nlv_days_txt = lv_days.\n\nIF lv_days GT 0 AND gv_ngtpr NE 0.\n  \" T07 : 연체\n  gv_txt = |{ TEXT-t07 } ( D + { lv_days NUMBER = USER } ) |.\n  REPLACE '&1' IN gv_txt WITH lv_days_txt.\nELSEIF lv_days LE 0 AND gv_ngtpr NE 0.\n  \" T08 : 순액만기일 미도래\n  gv_txt = TEXT-t08.\nELSE.\n  \" D09 : 수금 완료\n  gv_txt = TEXT-d09.\n\nENDIF.",
   "cap": "ZRD3SD0010_F01"
  },
  {
   "h": "아이템 조회와 세액 계산",
   "d": "헤더 더블클릭 시 합계/소계 행(<code>rowtype</code>)은 메시지 073으로 막고, 아이템을 조회한 뒤 세금코드 <code>A1</code>이면 순금액의 10%를 세금 금액으로 계산해 총액(<code>gross</code>)을 채움.",
   "lang": "abap",
   "src": "  \" 합계/소계 행 더블클릭 방지\n  IF e_row-rowtype IS NOT INITIAL.\n    \" 073 : 합계행을 선택하셨습니다. 다시 선택하세요.\n    MESSAGE s073 DISPLAY LIKE 'W'.\n    RETURN.\n  ENDIF.\n\n  \" 대금청구 아이템 조회\n  PERFORM select_billing_item USING e_row\n                                    e_column.\n  \" 헤더 ALV에서 선택한 행 셀 색깔 표시\n  PERFORM set_selected_color  USING e_row\n                                    e_column\n                                    es_row_no.\n  \" 아이템 ALV에서 관련 정보 세팅\n  \" 세금 금액\n  \" 세금 텍스트\n  \" 총액\n  PERFORM set_item.\n\n  MOVE-CORRESPONDING gt_billing_item TO gt_detail.\n\n  PERFORM refresh_alv_0100.\n\" ...\nLOOP AT gt_billing_item INTO gs_billing_item.\n\n  CASE gs_billing_item-mwskz.\n    WHEN 'A1'.\n      gs_billing_item-tax_price = gs_billing_item-netwr / 10.\n      \" 20 : 부가세\n      gs_billing_item-mwtxt = TEXT-d20.\n  ENDCASE.\n\n  gs_billing_item-gross = gs_billing_item-netwr + gs_billing_item-tax_price.\n\n  MODIFY gt_billing_item FROM gs_billing_item.\n\nENDLOOP.",
   "cap": "ZRD3SD0010_CLS"
  },
  {
   "h": "대금청구 번호 F4와 선택 화면 자동 입력",
   "d": "<code>AT SELECTION-SCREEN ON VALUE-REQUEST</code>에서 서치헬프 <code>ZSHD3SD0010</code>을 호출하고, 선택한 대금청구의 판매오더 · 출고요청 · 고객코드를 <code>DYNP_VALUES_UPDATE</code>로 선택 화면 필드에 함께 채움.",
   "lang": "abap",
   "src": "CALL FUNCTION 'F4IF_FIELD_VALUE_REQUEST'\n  EXPORTING\n    tabname     = 'ZTD3SD0010'\n    fieldname   = 'VBELN'\n    searchhelp  = 'ZSHD3SD0010'\n    dynpprog    = sy-repid\n    dynpnr      = sy-dynnr\n    dynprofield = 'SO_VB-LOW'\n  TABLES\n    return_tab  = lt_return.\n\nREAD TABLE lt_return INTO ls_return WITH KEY fieldname = 'VBELN'.\nIF sy-subrc <> 0.\n  RETURN.\nENDIF.\n\" ...\nls_dynp-fieldname  = 'SO_VB-LOW'.\nls_dynp-fieldvalue = ls_bill-vbeln.\nAPPEND ls_dynp TO lt_dynp.\n\nls_dynp-fieldname  = 'SO_VS-LOW'.\nls_dynp-fieldvalue = ls_bill-vbeln_so.\nAPPEND ls_dynp TO lt_dynp.\n\nls_dynp-fieldname  = 'SO_VD-LOW'.\nls_dynp-fieldvalue = ls_bill-dlrno.\nAPPEND ls_dynp TO lt_dynp.\n\nls_dynp-fieldname  = 'SO_CU-LOW'.\nls_dynp-fieldvalue = ls_bill-kunnr.\nAPPEND ls_dynp TO lt_dynp.\n\" ...\nCALL FUNCTION 'DYNP_VALUES_UPDATE'\n  EXPORTING\n    dyname     = sy-repid\n    dynumb     = sy-dynnr\n  TABLES\n    dynpfields = lt_dynp.",
   "cap": "ZRD3SD0010_F01"
  }
 ],
 "sd/5": [
  {
   "h": "최대 조회 건수 검증",
   "d": "<code>AT SELECTION-SCREEN ON pa_mrow</code>에서 입력값을 검증 · 음수는 100으로, 3000 초과는 3000으로 보정하고 1000건 이상 또는 0(전체)이면 지연 안내 메시지 출력",
   "lang": "abap",
   "src": "FORM check_max_row .\n\n  IF pa_mrow LT 0.\n\n    pa_mrow = 100.\n    \" 017: 최대 조회 건수는 &1건 이하일 수 없습니다.\n    MESSAGE s017 DISPLAY LIKE 'E' WITH 0.\n\n  ELSEIF pa_mrow GE 1000 AND pa_mrow LE 3000.\n    \" 238 : 조회 건수가 많아 조회 시간이 지연될 수 있습니다.\n    MESSAGE i238 DISPLAY LIKE 'W'.\n\n  ELSEIF pa_mrow GT 3000.\n\n    pa_mrow = 3000.\n    \" 018: 최대 조회 건수는 &1건 초과일 수 없습니다.\n    MESSAGE i018 DISPLAY LIKE 'E' WITH 3000.\n\n  ENDIF.\n\n  IF pa_mrow EQ 0.\n    \"238: 조회 건수가 많아 조회 시간이 지연될 수 있습니다.\n    MESSAGE i238 DISPLAY LIKE 'W'.\n\n  ENDIF.\n\nENDFORM.",
   "cap": "ZRD3FI0010_F01"
  },
  {
   "h": "세금계산서 헤더 조회 (3개 테이블 JOIN)",
   "d": "세금계산서 헤더 <code>ZTD3FI0013</code>에 고객마스터 <code>ZTD3SD0001</code>(고객명 · 대표자명)를 LEFT OUTER JOIN, 대금청구 헤더 <code>ZTD3SD0010</code>를 판매오더 번호로 INNER JOIN · 조회 조건 전체를 WHERE에 반영하고 <code>UP TO @pa_mrow ROWS</code>로 건수 제한",
   "lang": "abap",
   "src": "FORM select_tax_data.\n\n  REFRESH gt_tax_header.\n  \" ...\n  SELECT a~exnum,\n         a~exstat,\n         a~bukrs,\n         a~vbeln,\n         a~kunnr,\n         b~butxt,\n         b~repnm,\n         a~belnr,\n         a~gjahr,\n         a~bldat,\n         a~waers,\n         a~total_amt,\n         a~vat_amt\n    FROM            ztd3fi0013 AS a\n    LEFT OUTER JOIN ztd3sd0001 AS b\n      ON a~kunnr = b~kunnr\n    INNER JOIN      ztd3sd0010 AS c\n      ON a~vbeln = c~vbeln_so\n    WHERE a~kunnr IN @so_kun  AND\n          b~butxt IN @so_but  AND\n          a~exnum IN @so_exn  AND\n          a~gjahr IN @so_gja  AND\n          a~belnr IN @so_bel  AND\n          a~bldat IN @so_bud\n\n    INTO CORRESPONDING FIELDS OF TABLE @gt_tax_header\n    UP TO @pa_mrow ROWS.\n\n  SORT gt_tax_header BY kunnr exnum gjahr.\n\n  IF pa_mrow GT lines( gt_tax_header ).\n    pa_mrow = lines( gt_tax_header ).\n  ENDIF.",
   "cap": "ZRD3FI0010_F01"
  },
  {
   "h": "조회 조건 요약 문서 (Docking Container)",
   "d": "ALV 상단 <code>cl_gui_docking_container</code>에 <code>cl_dd_document</code>로 HTML 조회 조건표를 출력 · Select-Option 범위를 범용 FORM으로 읽어 BT는 '~', 제외(E)는 '제외:' 접두어, 미입력은 '전체'로 변환",
   "lang": "abap",
   "src": "FORM get_range_text  USING    it_range TYPE STANDARD TABLE\n                     CHANGING cv_text  TYPE string.\n\n  DATA lv_line TYPE string.\n\n  CLEAR cv_text.\n\n  LOOP AT it_range ASSIGNING FIELD-SYMBOL(<ls_range>).\n\n    ASSIGN COMPONENT 'SIGN'   OF STRUCTURE <ls_range> TO FIELD-SYMBOL(<sign>).\n    ASSIGN COMPONENT 'OPTION' OF STRUCTURE <ls_range> TO FIELD-SYMBOL(<option>).\n    ASSIGN COMPONENT 'LOW'    OF STRUCTURE <ls_range> TO FIELD-SYMBOL(<low>).\n    ASSIGN COMPONENT 'HIGH'   OF STRUCTURE <ls_range> TO FIELD-SYMBOL(<high>).\n\n    CLEAR lv_line.\n\n    CASE <option>.\n      WHEN 'BT'.\n        lv_line = |{ <low> } ~ { <high> }|.\n      WHEN 'EQ'.\n        lv_line = |{ <low> }|.\n      WHEN 'CP'.\n        lv_line = |{ <low> }|.\n      WHEN OTHERS.\n        lv_line = |{ <option> } { <low> } { <high> }|.\n    ENDCASE.\n\n    IF <sign> = 'E'.\n      lv_line = |제외: { lv_line }|.\n    ENDIF.\n\n    IF cv_text IS INITIAL.\n      cv_text = lv_line.\n    ELSE.\n      cv_text = cv_text && `, ` && lv_line.\n    ENDIF.\n\n  ENDLOOP.\n\n  IF cv_text IS INITIAL.\n    cv_text = '전체'.\n  ENDIF.\nENDFORM.",
   "cap": "ZRD3FI0010_F01"
  },
  {
   "h": "ALV 툴바 버튼으로 최대 조회 건수 변경 · 재조회",
   "d": "<code>toolbar</code> 이벤트로 'SHOW_ROW' 버튼을 추가하고, 클릭 시 함수 <code>ZFD3PP0004</code> 팝업으로 건수를 변경한 뒤 데이터 재조회 · Grid Title 갱신 · ALV 새로고침",
   "lang": "abap",
   "src": "FORM set_show_row .\n\n  FIELD-SYMBOLS : <ft_lines>    TYPE i.   \" 조회 조건으로 검색한 전체 결과 갯수\n  FIELD-SYMBOLS : <ft_max_rows> TYPE i.   \" 조회 조건으로 검색한 결과 중 최대 조회 건수 제한에 따라 검색된 갯수\n\n  ASSIGN gv_lines_bi TO <ft_lines>.\n  ASSIGN pa_mrow     TO <ft_max_rows>.\n\n*     1. 조회조건에서 입력된 최대 조회 건수를 가져와서 변경한다.\n  call function 'ZFD3PP0004'\n    CHANGING\n      cv_max_row = <ft_max_rows>.   \" Max Row 변수\n\n*     2. 데이터 재조회\n  PERFORM select_data.        \" 데이터 조회\n  PERFORM modify_data.\n\n  gv_alv_100_title = | { TEXT-t05 } ({ pa_mrow NUMBER = USER })건 |. \" t05: 발생 거래 건수\n\n*     2. ALV 화면 새로고침\n  PERFORM refresh_alv_0100.\n\nENDFORM.\n\" ...\nFORM handle_toolbar  USING    po_object  TYPE REF TO cl_alv_event_toolbar_set.\n\n  DATA ls_button LIKE LINE OF po_object->mt_toolbar.\n\n  \" 최대 조회 건수 변경하기 위한 버튼\n  CLEAR ls_button.\n  ls_button-function = 'SHOW_ROW'.\n  ls_button-butn_type = 0.  \" 0: Normal\n  ls_button-icon = icon_add_row.\n  \" D02 : 최대 조회 건수 변경\n  ls_button-text = TEXT-d02.\n  APPEND ls_button TO po_object->mt_toolbar.\n\nENDFORM.",
   "cap": "ZRD3FI0010_F01"
  },
  {
   "h": "전표번호 핫스팟 → 전표 단일 조회 이동",
   "d": "<code>hotspot_click</code> 이벤트에서 선택 행의 회사코드 · 회계연도 · 전표번호를 <code>SET PARAMETER ID</code> BUK · GJR · BLN으로 전달하고 <code>CALL TRANSACTION 'ZRD3FI0001' AND SKIP FIRST SCREEN</code>으로 상세 화면 호출",
   "lang": "abap",
   "src": "FORM handle_hotspot_click  USING    p_row_id    TYPE  lvc_s_row\n                                    p_column_id TYPE  LVC_S_col.\n\n  READ TABLE gt_tax_header INTO gs_tax_header INDEX p_row_id-index.\n\n*     출력용 ITAB에서 선택한 행에 대한 정보를 찾지 못할 경우 중단한다.\n  IF sy-subrc NE 0.\n    RETURN.\n  ENDIF.\n\n*     선택한 컬럼명의 필드명에 따라 로직을 구현한다.\n  CASE p_column_id-fieldname.\n    WHEN 'BELNR'. \" 전표번호\n      SET PARAMETER ID 'BUK' FIELD gs_tax_header-bukrs.   \" 회사코드\n      SET PARAMETER ID 'GJR' FIELD gs_tax_header-gjahr.   \" 회계연도\n      SET PARAMETER ID 'BLN' FIELD gs_tax_header-belnr.   \" 전표번호\n\n      CALL TRANSACTION 'ZRD3FI0001' AND SKIP FIRST SCREEN.  \" 전표 단일 조회 프로그램 호출\n\n  ENDCASE.\n\nENDFORM.",
   "cap": "ZRD3FI0010_F01"
  },
  {
   "h": "승인 대상 선택 검증",
   "d": "<code>get_selected_rows</code>로 선택 행을 가져와 미선택(080) · 다중 선택(079)을 차단하고, 승인 상태 <code>EXSTAT</code>가 'P'인 건은 087 메시지로 막은 뒤 승인 화면 0200 호출",
   "lang": "abap",
   "src": "FORM select_index .\n\n  DATA: lt_rows TYPE lvc_t_row,\n        ls_row  TYPE lvc_s_row.\n\n  \" 사용자가 ALV에서 수정한 값 먼저 내부테이블에 반영\n  CALL METHOD go_alv_grid->check_changed_data.\n\n  \" 선택 행 가져오기\n  CALL METHOD go_alv_grid->get_selected_rows\n    IMPORTING\n      et_index_rows = lt_rows.\n\n  \" 선택 안 했을 때\n  IF lt_rows IS INITIAL.\n    \" 데이터를 선택해 주세요\n    MESSAGE s080 DISPLAY LIKE 'W'.\n    RETURN.\n  ENDIF.\n\n  \" 여러 행 선택했을 때\n  IF lines( lt_rows ) GT 1.\n    \" 데이터를 1건만 선택해 주세요\n    MESSAGE s079 DISPLAY LIKE 'W'.\n    RETURN.\n  ENDIF.\n\n  READ TABLE lt_rows INTO ls_row INDEX 1.\n\n  CLEAR gs_display1.\n  CLEAR gv_index.\n\n  READ TABLE gt_display1 INTO gs_display1 INDEX ls_row-index.\n\n  gv_index = ls_row-index.\n\n  IF gs_display1-exstat EQ 'P'.\n    \" 087 : 이미 세금계산서가 승인된 건입니다.\n    MESSAGE s087 DISPLAY LIKE 'A'.\n    RETURN.\n  ENDIF.\n\n  CALL SCREEN 0200.",
   "cap": "ZRD3FI0010_F01"
  },
  {
   "h": "세금계산서 승인 처리",
   "d": "확인 팝업(<code>POPUP_TO_CONFIRM</code>)에서 확인한 경우에만 실행 · 세금계산서 헤더 <code>EXSTAT</code>를 'P'(승인)로, 대금청구 헤더 <code>VBSTAT</code>를 'B'(세금계산서 발행 완료)로 UPDATE 후 결과 메시지 출력 및 화면 데이터 반영",
   "lang": "abap",
   "src": "FORM update_tax_db .\n\n  CHECK gv_ok IS NOT INITIAL.\n\n  \" 세금계산서 상태 승인으로 변경\n  UPDATE ztd3fi0013\n     SET exstat = 'P'\n   WHERE exnum EQ @gs_display1-exnum.\n\n  \" 대금청구 상태 세금계산서 발행 완료로 변경\n  UPDATE ztd3sd0010\n     SET vbstat = 'B'\n   WHERE vbeln_so EQ @gs_display1-vbeln.\n\n  IF sy-subrc EQ 0.\n    \" 세금계산서 승인이 완료되었습니다.\n    MESSAGE s240 DISPLAY LIKE 'S'.\n    gs_display1-exstat = 'P'.\n  ELSE.\n    \" 세금계산서 승인 실패하였습니다.\n    MESSAGE s241 DISPLAY LIKE 'A'.\n  ENDIF.\n\nENDFORM.",
   "cap": "ZRD3FI0010_F01"
  },
  {
   "h": "거래 항목 세액 · 할인 금액 계산",
   "d": "참조 판매오더 아이템을 ALV로 보여주기 전 품목별 세액과 할인 금액을 계산 · 세금코드 'A1'이면 공급가액의 10%를 품목 세액으로 넣고 판매오더 헤더 세액에 누적",
   "lang": "abap",
   "src": "FORM set_mwspr .\n\n  \" 세액 설정\n  IF gs_so_de-mwskz EQ 'A1'.\n    \" 부가세는 10%\n    \" 세액 아이템에 넣기(각 자재에 대한 세액)\n    gs_so_de-mwspr = gs_so_de-netwr / 10.\n\n    \" 세액 헤더에 넣기(세액 총액)\n    gs_so-mwsts += gs_so_de-mwspr.\n\n  ELSE.\n\n    \" 다른 세금코드에 대한 설정\n    \" 해당 프로젝트는 부가세에 대해서만 설정하였음\n    gs_so_de-mwspr = space.\n  ENDIF.\n\nENDFORM.\n\" ...\nFORM set_KBEPR .\n\n  \" 만약 할인율이 존재한다면\n  IF gs_so_de-kbetr NE 0.\n    \" 할인율에 대한 할인액 설정\n    gs_so_de-kbepr = gs_so_de-netwr * gs_so_de-kbetr.\n  ELSE.\n    \" 할인율이 없다면 할인액 0으로 설정\n    gs_so_de-kbepr = 0.\n  ENDIF.\n\nENDFORM.",
   "cap": "ZRD3FI0010_F01"
  }
 ],
 "sd/7": [
  {
   "h": "실행 모드 분기 (배치 / 온라인)",
   "d": "<code>INITIALIZATION</code>에서 API 키와 기준일자(오늘)를 세팅하고, <code>sy-batch</code>가 참이면 API 수집 · 저장만 수행한 뒤 <code>LEAVE PROGRAM</code> · 온라인 실행이면 조회 ALV 화면 출력",
   "lang": "abap",
   "src": "INITIALIZATION.\n  PERFORM set_api_key.\n  PERFORM set_default.\n\nAT SELECTION-SCREEN OUTPUT.\n\n  PERFORM set_listbox_waer.\n\nSTART-OF-SELECTION.\n\n  IF sy-batch = abap_true.\n\n    \"PERFORM get_exchange_rate_batch.\n    PERFORM get_exchange_rate.\n    PERFORM save_exchange_rate_batch.\n\n    LEAVE PROGRAM.\n\n  ENDIF.\n\n  PERFORM select_data.\n  PERFORM modify_data.\n  PERFORM display_data.",
   "cap": "ZRD3FI0011"
  },
  {
   "h": "Open API 호출 (HTTP GET)",
   "d": "<code>cl_http_client=>create_by_url</code>로 기준일자(<code>searchdate</code>) · <code>data=AP01</code> 요청 URL을 만들어 GET 송수신 · 단계별 예외를 메시지 074~077로 구분하고 <code>/ui2/cl_json=>deserialize</code>로 응답 JSON을 내부 테이블로 변환",
   "lang": "abap",
   "src": "lv_date = gv_gdatu.\n\nCONCATENATE gc_url\n            '?authkey=' gv_api_key\n            '&searchdate=' lv_date\n            '&data=AP01'\n       INTO lv_url.\n\ncl_http_client=>create_by_url(\n  EXPORTING\n    url    = lv_url\n  IMPORTING\n    client = lo_client\n  EXCEPTIONS\n    argument_not_found = 1\n    plugin_not_active  = 2\n    internal_error     = 3\n    OTHERS             = 4 ).\n\" ...\nIF sy-subrc <> 0.\n  lo_client->close( ).\n  \" 075 : API 요청 실패\n  MESSAGE s075 DISPLAY LIKE 'E'.\n  RETURN.\nENDIF.\n\" ...\nlv_response = lo_client->response->get_cdata( ).\n\nlo_client->close( ).\n\nIF lv_response IS INITIAL.\n  \" 077 : API 응답이 비어 있습니다.\n  MESSAGE s077 DISPLAY LIKE 'E'.\n  RETURN.\nENDIF.\n\nTRY.\n    /ui2/cl_json=>deserialize(\n      EXPORTING\n        json = lv_response\n      CHANGING\n        data = gt_api_rate ).\n\n  CATCH cx_root.\n    \" API 응답 데이터 변환 중 오류가 발생했습니다.\n    MESSAGE s081 DISPLAY LIKE 'E'.\n    RETURN.\nENDTRY.",
   "cap": "ZRD3FI0011_F01"
  },
  {
   "h": "환율 데이터 변환 · 중복 체크",
   "d": "응답 중 USD만 대상으로 동일 통화 · 기준일자가 이미 <code>ZTD3FI0008</code>에 있으면 082 메시지로 중단 · 문자열로 받은 매매기준율(<code>deal_bas_r</code>)은 <code>MOVE_CHAR_TO_NUM</code>으로 숫자 변환 후 환율유형 'M', KRW 기준 레코드 구성",
   "lang": "abap",
   "src": "LOOP AT gt_api_rate INTO gs_api_rate.\n\n  CHECK gs_api_rate-cur_unit = 'USD'.\n  \" ...\n  \" DB 중복 체크\n  DATA : ls_exist TYPE ztd3fi0008.\n  CLEAR ls_exist.\n\n  SELECT SINGLE *\n    FROM ztd3fi0008\n   WHERE fcurr = @lv_cur_unit\n     AND gdatu = @gv_gdatu\n    INTO @ls_exist.\n\n  IF sy-subrc = 0.\n    \" 이미 존재하면 스킵\n    MESSAGE s082 DISPLAY LIKE 'A'.\n    RETURN.\n  ENDIF.\n\n  lv_rate_char = gs_api_rate-deal_bas_r.\n\n  CALL FUNCTION 'MOVE_CHAR_TO_NUM'\n    EXPORTING\n      chr             = lv_rate_char\n    IMPORTING\n      num             = lv_rate\n    EXCEPTIONS\n      convt_no_number = 1\n      convt_overflow  = 2\n      OTHERS          = 3.\n\n  IF sy-subrc <> 0.\n    CONTINUE.\n  ENDIF.\n  \" ...\n  \" 환율유형 코드\n  gs_exrate-kurst = 'M'.\n\n  \" 기준통화\n  gs_exrate-fcurr = lv_cur_unit.\n\n  \" 대상통화\n  gs_exrate-tcurr = 'KRW'.\n  \" ...\n  APPEND gs_exrate TO gt_exrate.\n\nENDLOOP.",
   "cap": "ZRD3FI0011_F01"
  },
  {
   "h": "환율 미수신 사유 판정",
   "d": "수집 결과가 비어 있으면 <code>DATE_COMPUTE_DAY</code>로 요일을 구해 주말은 085, 평일 11시 이전은 078(고시 전), 그 외는 085 메시지로 원인 안내",
   "lang": "abap",
   "src": "\" 환율이 들어오지 않은 경우\n\" 1. 11시 전\n\" 2. 주말 혹은 공휴일\nIF gt_exrate IS INITIAL.\n\n  DATA: lv_weekday TYPE scal-indicator,\n        lv_hour    TYPE i.\n\n  lv_hour = sy-uzeit(2).\n\n  CALL FUNCTION 'DATE_COMPUTE_DAY'\n    EXPORTING\n      date = gv_gdatu\n    IMPORTING\n      day  = lv_weekday.\n\n  \" 토요일(6), 일요일(7)은 환율 미제공일\n  IF lv_weekday = 6 OR lv_weekday = 7.\n    \" 085 : 해당 일자는 환율이 제공되지 않는 날짜입니다.\n    MESSAGE s085 DISPLAY LIKE 'E'.\n    RETURN.\n  ENDIF.\n\n  \" 평일인데 11시 이전이면 아직 생성 전\n  IF lv_hour < 11.\n    \" 078 : 현재 기준일자에 대한 환율정보가 없습니다. 11시 이후에 다시 시도하세요.\n    MESSAGE s078 DISPLAY LIKE 'E'.\n    RETURN.\n  ENDIF.\n\n  \" 평일 11시 이후에도 없으면 미제공일 또는 API 미제공\n  \" 086 : 해당 일자는 환율이 제공되지 않는 날짜입니다.\n  MESSAGE s085 DISPLAY LIKE 'E'.\n  RETURN.\n\nENDIF.",
   "cap": "ZRD3FI0011_F01"
  },
  {
   "h": "환율 저장 · COMMIT / ROLLBACK",
   "d": "기준일자 데이터 존재 여부에 따라 <code>MODIFY</code> 또는 <code>INSERT</code> · 성공 시 <code>COMMIT WORK</code>와 083 메시지, 실패 시 <code>ROLLBACK WORK</code>와 084 메시지",
   "lang": "abap",
   "src": "CLEAR ls_exist.\n\nSELECT SINGLE *\n  FROM ztd3fi0008\n WHERE gdatu = @gv_gdatu\n  INTO @ls_exist.\n\nIF sy-subrc = 0.\n  MODIFY ztd3fi0008 FROM gs_exrate.\n  \" 새로운 생성이라면\nELSE.\n  INSERT ztd3fi0008 FROM gs_exrate.\nENDIF.\n\nIF sy-subrc = 0.\n  COMMIT WORK.\n  \" 083 : 환율 저장이 완료되었습니다.\n  MESSAGE s083 DISPLAY LIKE 'S'.\nELSE.\n  ROLLBACK WORK.\n  \" 084 : 환율 저장 중 오류가 발생했습니다.\n  MESSAGE s084 DISPLAY LIKE 'E'.\n  RETURN.\nENDIF.",
   "cap": "ZRD3FI0011_F01"
  },
  {
   "h": "기준 통화 Listbox 동적 구성",
   "d": "<code>AT SELECTION-SCREEN OUTPUT</code>에서 최초 1회만 <code>SELECT DISTINCT fcurr</code>로 저장된 통화를 읽어 <code>VRM_SET_VALUES</code>로 Listbox 값 세팅",
   "lang": "abap",
   "src": "FORM set_listbox_waer .\n\n  CHECK gv_start IS INITIAL.\n\n  DATA: lt_values TYPE vrm_values,\n        ls_value  TYPE vrm_value,\n        lt_waers  TYPE TABLE OF ztd3fi0008,\n        ls_waers  LIKE LINE OF lt_waers.\n\n  \" db에 저장된 중복되지 않은 키값을 가져온다\n  PERFORM select_distinct_waers TABLES lt_waers.\n\n  REFRESH lt_values.\n\n  LOOP AT lt_waers INTO ls_waers.\n\n    CLEAR ls_value.\n    ls_value-key  = ls_waers-fcurr.\n    ls_value-text = ls_waers-fcurr.\n    APPEND ls_value TO lt_values.\n\n  ENDLOOP.\n\n  CALL FUNCTION 'VRM_SET_VALUES'\n    EXPORTING\n      id     = 'P_WAER'\n      values = lt_values.\n\n  gv_start = abap_true.\n\nENDFORM.\n\" ...\nFORM select_distinct_waers  TABLES   pt_waers.\n\n  SELECT DISTINCT fcurr\n    FROM ztd3fi0008\n    INTO CORRESPONDING FIELDS OF TABLE @pt_waers.\n\nENDFORM.",
   "cap": "ZRD3FI0011_F01"
  },
  {
   "h": "전일대비 · 변동률 계산",
   "d": "기준일자 내림차순 정렬된 목록에서 다음 행(직전 영업일)과 비교해 차이와 변동률(%)을 계산 · 상승은 <code>icon_next_value</code>와 '+', 하락은 <code>icon_previous_value</code>와 '-'로 표시",
   "lang": "abap",
   "src": "FORM get_rate .\n\n  DATA : lv_rate_per TYPE p LENGTH 5 DECIMALS 2.\n  DATA : lv_rate     TYPE p LENGTH 9 DECIMALS 2.\n  DATA : lv_icon     TYPE icon-name.\n\n  \" 영업일 기준 전날 데이터를 저장하기 위한 스트럭쳐\n  DATA : ls_waers_ye TYPE zsd3fi0008.\n\n  IF sy-tabix EQ lines( gt_waers ).\n    RETURN.\n  ENDIF.\n\n  READ TABLE gt_waers INTO ls_waers_ye INDEX sy-tabix + 1.\n\n  lv_rate     = gs_waers-ukurs - ls_waers_ye-ukurs.\n  lv_rate_per = ( gs_waers-ukurs - ls_waers_ye-ukurs ) / ls_waers_ye-ukurs * 100.\n\n  \" 현재 행의 환율이 전날보다 높다면\n  IF gs_waers-ukurs GT ls_waers_ye-ukurs.\n\n    lv_icon = icon_next_value.\n\n    gs_waers-rate =\n      |{ lv_icon }{ lv_rate NUMBER = USER }|.\n\n    gs_waers-rate_per =\n      |+{ lv_rate_per NUMBER = USER }%|.\n\n    \" 현재 행의 환율이 전날보다 낮다면\n  ELSEIF gs_waers-ukurs LT ls_waers_ye-ukurs.\n\n    lv_icon = icon_previous_value.\n\n    lv_rate     = abs( lv_rate ).\n    lv_rate_per = abs( lv_rate_per ).\n\n    gs_waers-rate =\n      |{ lv_icon }{ lv_rate NUMBER = USER }|.\n\n    gs_waers-rate_per =\n      |-{ lv_rate_per NUMBER = USER }%|.\n\n    \" 현재 행의 환율이 전날과 같으면\n  ELSEIF gs_waers-ukurs EQ ls_waers_ye-ukurs.\n\n    lv_icon = space.\n\n    gs_waers-rate =\n      |{ lv_icon }{ lv_rate NUMBER = USER }|.\n\n    gs_waers-rate_per =\n      |{ lv_rate_per NUMBER = USER }%|.\n\n  ENDIF.\n\nENDFORM.",
   "cap": "ZRD3FI0011_F01"
  },
  {
   "h": "수동 환율 생성 (팝업 화면 0110)",
   "d": "환율 조회 화면의 'INSERT' 버튼으로 기준일자 입력 팝업을 띄우고, 'CONT' 시 저장 확인 팝업 후 지정 일자 기준으로 API 수집 · 저장 · 재조회 실행",
   "lang": "abap",
   "src": "MODULE user_command_0110 INPUT.\n\n  CASE ok_code.\n    WHEN 'CONT'.\n      PERFORM popup_to_confirm USING ok_code\n                                     gv_ok.\n      IF gv_ok IS NOT INITIAL.\n\n        PERFORM get_exchange_rate.\n        PERFORM save_exchange_rate.\n        PERFORM select_data.\n\n        CLEAR gv_ok.\n\n      ENDIF.\n\n      LEAVE TO SCREEN 0.\n  ENDCASE.\n\nENDMODULE.",
   "cap": "ZRD3FI0011_PBO"
  }
 ]
};
