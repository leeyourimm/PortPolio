/* 핵심 로직 코드: 포트폴리오 PDF 코드 캡처를 텍스트로 옮긴 것 */
window.CODE = {
"erp1-c1": {
 "lang": "abap",
 "panes": [
  {
   "lang": "abap",
   "src": "CALL FUNCTION 'Z_FI_DOCUMENT_POST_1'\n  DESTINATION 'NONE'\n  EXPORTING\n    iv_web_id  = cs_document-web_id\n    iv_api_url = gc_api_base_url\n    iv_api_key = gc_api_key\n    iv_obj_key = lv_obj_key\n  IMPORTING\n    ev_success = lv_success\n    ev_message = lv_message."
  }
 ]
},
"erp1-c2": {
 "lang": "abap",
 "panes": [
  {
   "lang": "abap",
   "src": "CLEAR: ev_success, ev_message.\n\nlv_url  = iv_api_url && |/api/entries/{ iv_web_id }/link-document|.\nlv_body = |\\{\"obj_key\":\"{ iv_obj_key }\"\\}|.\n\ncl_http_client=>create_by_url(\n  EXPORTING url    = lv_url\n  IMPORTING client = lo_client\n  EXCEPTIONS OTHERS = 4 ).\nIF sy-subrc <> 0.\n  ev_success = abap_false.\n  ev_message = 'HTTP 클라이언트 생성 실패'.\n  RETURN.\nENDIF.\n\nlo_client->request->set_method( 'POST' ).\nlo_client->request->set_header_field( name = 'X-API-Key' value = iv_api_key ).\nlo_client->request->set_header_field( name = 'ngrok-skip-browser-warning' value = 'true' ).\nlo_client->request->set_header_field( name = 'Content-Type' value = 'application/json' ).\nlo_client->request->set_cdata( lv_body ).\n\nlo_client->send( EXCEPTIONS OTHERS = 3 ).\nIF sy-subrc <> 0.\n  ev_success = abap_false.\n  ev_message = 'API 서버 연결 실패'.\n  lo_client->close( ).\n  RETURN.\nENDIF.\n\nlo_client->receive( EXCEPTIONS OTHERS = 4 ).\nIF sy-subrc <> 0.\n  ev_success = abap_false.\n  ev_message = 'API 응답 수신 실패'.\n  lo_client->close( ).\n  RETURN.\nENDIF.\n\nlo_client->response->get_status( IMPORTING code = lv_code reason = lv_reason ).\nlo_client->close( ).\n\nIF lv_code = 200.\n  ev_success = abap_true.\n  ev_message = '처리완료 표시 성공'.\nELSE.\n  ev_success = abap_false."
  }
 ]
},
"erp1-c3": {
 "lang": "abap",
 "panes": [
  {
   "lang": "abap",
   "src": "FORM build_document_header USING is_document TYPE ty_document.\n\n  CLEAR gs_documentheader.\n\n  gs_documentheader-username   = sy-uname.\n  gs_documentheader-header_txt = is_document-sgtxt.\n  gs_documentheader-comp_code  = is_document-bukrs.\n  gs_documentheader-doc_date   = is_document-bldat.\n  gs_documentheader-pstng_date = is_document-budat.\n  gs_documentheader-doc_type   = is_document-blart.\n  gs_documentheader-fisc_year  = is_document-budat(4).\n  gs_documentheader-fis_period = is_document-budat+4(2).\n\nENDFORM."
  }
 ]
},
"erp1-c4": {
 "lang": "abap",
 "panes": [
  {
   "lang": "abap",
   "src": "*&   차변 = 양수, 대변 = 음수\n*& 계정 라인과 금액 라인은 ITEMNO_ACC(라인번호)로 연결\n*&---------------------------------------------------------------------*\nFORM build_accounting_items USING is_document TYPE ty_document.\n\n  DATA: ls_accountgl         TYPE bapiacgl09,\n        ls_accountreceivable TYPE bapiacar09,\n        ls_currencyamount    TYPE bapiaccr09.\n\n  CLEAR: gt_accountgl, gt_accountreceivable, gt_currencyamount.\n\n  \" 1. 매출채권 (차변) - 지점에 매핑된 고객\n  ls_accountreceivable-itemno_acc = '0000000001'.\n  ls_accountreceivable-customer   = is_document-kunnr.\n  ls_accountreceivable-comp_code  = is_document-bukrs.\n  ls_accountreceivable-item_text  = is_document-sgtxt.\n  APPEND ls_accountreceivable TO gt_accountreceivable.\n\n  CLEAR ls_currencyamount.\n  ls_currencyamount-itemno_acc = '0000000001'.\n  ls_currencyamount-curr_type  = '00'.                 \" 00 = 전표 통화\n  ls_currencyamount-currency   = is_document-waers.\n  ls_currencyamount-amt_doccur = is_document-wrbtr.    \" 차변 : 양수\n  APPEND ls_currencyamount TO gt_currencyamount.\n\n  \" 2. 매출 (대변) - 매출 G/L 계정\n  ls_accountgl-itemno_acc = '0000000002'.\n  ls_accountgl-gl_account = is_document-hkont.\n  ls_accountgl-comp_code  = is_document-bukrs.\n  ls_accountgl-item_text  = is_document-sgtxt.\n  APPEND ls_accountgl TO gt_accountgl.\n\n  CLEAR ls_currencyamount.\n  ls_currencyamount-itemno_acc = '0000000002'.\n  ls_currencyamount-curr_type  = '00'.\n  ls_currencyamount-currency   = is_document-waers.\n  ls_currencyamount-amt_doccur = is_document-wrbtr * -1.   \" 대변 : 음수\n  APPEND ls_currencyamount TO gt_currencyamount."
  }
 ]
},
"erp1-c5": {
 "lang": "abap",
 "panes": [
  {
   "lang": "abap",
   "src": "*&---------------------------------------------------------------------*\n*&      Form  BUILD_EXTENSION_BUPLA   (BUPLA BAdI용 EXTENSION2 세팅)\n*&---------------------------------------------------------------------*\n*& BAPI 라인 구조에는 사업장(BUPLA) 필드가 없으므로 EXTENSION2로 전달\n*& → BAdI ACC_DOCUMENT(CHANGE)에서 라인번호가 같은 전표 라인에 반영\n*&\n*& STRUCTURE  : 대상 구조 (BSEG)\n*& VALUEPART1 : 라인번호 (ITEMNO_ACC와 동일)\n*& VALUEPART2 : 필드명\n*& VALUEPART3 : 값\n*&---------------------------------------------------------------------*\nFORM build_extension_bupla .\n\n  DATA: ls_extension2 TYPE bapiparex.\n\n  REFRESH gt_extension2.\n\n  \" 1번 라인 (매출채권)\n  CLEAR ls_extension2.\n  ls_extension2-structure  = 'BSEG'.\n  ls_extension2-valuepart1 = '0000000001'.\n  ls_extension2-valuepart2 = 'BUPLA'.\n  ls_extension2-valuepart3 = gc_bupla.\n  APPEND ls_extension2 TO gt_extension2.\n\n  \" 2번 라인 (매출)\n  CLEAR ls_extension2.\n  ls_extension2-structure  = 'BSEG'.\n  ls_extension2-valuepart1 = '0000000002'.\n  ls_extension2-valuepart2 = 'BUPLA'.\n  ls_extension2-valuepart3 = gc_bupla.\n  APPEND ls_extension2 TO gt_extension2.\n\nENDFORM."
  }
 ]
},
"erp1-c6": {
 "lang": "abap",
 "panes": [
  {
   "lang": "abap",
   "src": "*&---------------------------------------------------------------------*\n*&      Form  CALL_BAPI_DOCUMENT_POST\n*&---------------------------------------------------------------------*\n*& 구성된 헤더/라인/금액/확장 데이터로 회계전표 BAPI 호출\n*& (COMMIT은 호출한 쪽에서 처리)\n*&---------------------------------------------------------------------*\nFORM call_bapi_document_post .\n\n  CLEAR: gt_return, gv_obj_type, gv_obj_key, gv_obj_sys.\n\n  CALL FUNCTION 'BAPI_ACC_DOCUMENT_POST'\n    EXPORTING\n      documentheader    = gs_documentheader      \" 헤더\n    IMPORTING\n      obj_type          = gv_obj_type\n      obj_key           = gv_obj_key             \" 생성된 전표 키 → 웹 회신에 사용\n      obj_sys           = gv_obj_sys\n    TABLES\n      accountgl         = gt_accountgl           \" G/L 라인 (대변 매출)\n      accountreceivable = gt_accountreceivable   \" 고객 라인 (차변 매출채권)\n      currencyamount    = gt_currencyamount      \" 라인별 금액\n      extension2        = gt_extension2          \" 사업장(BUPLA) 확장 필드\n      return            = gt_return.             \" 처리 결과 메시지\n\nENDFORM."
  }
 ]
},
"erp1-c7": {
 "lang": "abap",
 "panes": [
  {
   "lang": "abap",
   "src": "*&---------------------------------------------------------------------*\n*&      Form  POST_DOCUMENT   (체크 X: 실제 전표 생성)\n*&---------------------------------------------------------------------*\n*& 전기 → 성공 시 COMMIT → 웹 DB에 처리완료 회신\n*& 실패 시 ROLLBACK 하고 웹 DB는 건드리지 않음 (다음 배치에서 재시도)\n*&---------------------------------------------------------------------*\nFORM post_document CHANGING cs_document TYPE ty_document.\n\n  DATA: lv_success TYPE abap_bool,\n        lv_msg     TYPE string.\n\n  PERFORM call_bapi_document_post.\n  PERFORM check_bapi_return CHANGING lv_success lv_msg.\n\n  \" 실패 : 롤백 후 빨간불, 웹 회신 없이 종료\n  IF lv_success = abap_false.\n    cs_document-status_tx = |전표 생성 실패: { lv_msg }|.\n    cs_document-icon      = icon_red_light.\n    CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.\n    RETURN.\n  ENDIF.\n\n  \" 성공 : DB 반영 (WAIT = X → 업데이트 완료까지 대기)\n  CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'\n    EXPORTING\n      wait = 'X'.\n\n  cs_document-status_tx = |전표 생성 완료: { gv_obj_key }|.\n  cs_document-icon      = icon_green_light.\n  cs_document-belnr     = gv_obj_key+0(10).   \" 전표 키 앞 10자리 = 전표번호\n\n  \" COMMIT이 끝난 뒤에만 웹 DB에 처리완료 표시\n  \" → 실제로 생성된 전표만 웹에서 처리완료가 됨\n  PERFORM mark_entry_processed CHANGING cs_document.\n\n\n\nENDFORM."
  }
 ]
},
"sd7-c1": {
 "lang": "js",
 "panes": [
  {
   "lang": "js",
   "src": "onValueHelpExnum: function () {\n    if (!this._oExnumHelp) {\n        this._oExnumHelp = new SelectDialog({\n            title: \"세금계산서 선택\",\n            items: {\n                path: \"/ZCDS_D3_SD_0011\",\n                template: new StandardListItem({ title: \"{Exnum}\", description: \"{Kunnr}\" })\n            },\n            confirm: function (oEvent) {\n                var oItem = oEvent.getParameter(\"selectedItem\");\n                if (oItem) { this.byId(\"idSearchExnum\").setValue(oItem.getTitle()); }\n            }.bind(this)\n        });\n        this.getView().addDependent(this._oExnumHelp);\n    }\n    this._oExnumHelp.setModel(this.getOwnerComponent().getModel());\n    this._oExnumHelp.open();\n},"
  }
 ]
},
"sd7-c2": {
 "lang": "js",
 "panes": [
  {
   "lang": "js",
   "src": "/** html2pdf.js를 CDN에서 동적 로드. 이미 로드된 경우 즉시 resolve */\n_loadHtml2Pdf: function () {\n    return this._loadScript(\n        \"html2pdfScript\",\n        \"https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.3/html2pdf.bundle.min.js\",\n        function () { return typeof window.html2pdf === \"function\"; }\n    );\n},"
  }
 ]
},
"sd9-c1": {
 "lang": "xml",
 "panes": [
  {
   "lang": "xml",
   "src": "<!-- 달별 상세 -->\n<VBox id=\"idMonthDetailBox\" visible=\"{= ${view>/viewType} === 'month' }\">\n\n    <ObjectHeader\n        id=\"idDetailObjHeader\"\n        title=\"{view>/selected/Day}\"\n        number=\"{view>/selected/Ukurs}\"\n        numberUnit=\"{view>/FCURR}\"\n        numberState=\"{view>/selected/State}\"\n        fullScreenOptimized=\"true\"\n        class=\"sapUiSmallMarginBottom\">\n        <attributes>\n            <ObjectAttribute id=\"idAttrMonth\"\n                             title=\"조회 월\"\n                             text=\"{view>/monthText}\"/>\n            <ObjectAttribute id=\"idAttrDiffAmt\"\n                            title=\"전일 대비 변동금액\"\n                            text=\"{view>/selected/DiffAmt}\"/>\n        </attributes>\n        <statuses>\n            <ObjectStatus id=\"idStatusDiffRate\"\n                          title=\"전일 대비 변동률\"\n                          text=\"{view>/selected/DiffRate}%\"\n                          state=\"{view>/selected/State}\"\n                          icon=\"{view>/selected/StateIcon}\"/>\n            <ObjectStatus id=\"idStatusAvgDiff\"\n                          title=\"월 평균 대비\"\n                          text=\"{view>/selected/DiffFromAvg}\"\n                          state=\"{view>/selected/AvgState}\"/>"
  }
 ]
},
"sd9-c3": {
 "lang": "js",
 "panes": [
  {
   "lang": "js",
   "src": "_buildChartData: function (aResults) {\n    var aData = [];\n\n    aResults.forEach(function (oItem) {\n        var oDate  = this._parseDate(oItem.Gdatu);\n        if (!oDate || isNaN(oDate.getTime())) { return; }\n\n        var iDay   = oDate.getDate();\n        var fUkurs = Number(oItem.Ukurs);\n\n        if (oDate.getFullYear()  === this._iCurrentYear  &&\n            oDate.getMonth() + 1 === this._iCurrentMonth &&\n            fUkurs > 0) {\n            aData.push({\n                Day:            (iDay < 10 ? \"0\" + iDay : String(iDay)) + \"(\" + _DOW[oDate.getDay()] + \")\",\n                DayNum:         iDay,\n                Year:           this._iCurrentYear,\n                Ukurs:          fUkurs,\n                DiffRate:       0,\n                DiffAmt:        0,\n                SettlementRate: null\n            });\n        }\n    }.bind(this));"
  }
 ]
},
"sd9-c4": {
 "lang": "js",
 "panes": [
  {
   "lang": "js",
   "src": "// 결산 환율: 매주 월요일 또는 가장 가까운 이전 영업일에 마킹\nfor (var d = 1; d <= this._getDaysInMonth(); d++) {\n    if (new Date(this._iCurrentYear, this._iCurrentMonth - 1, d).getDay() !== 1) { continue; }\n    var oSettle = this._findNearestPrev(aData, d);\n    if (oSettle) { oSettle.SettlementRate = oSettle.Ukurs; }\n}\n\nreturn aData;"
  }
 ]
}
};
