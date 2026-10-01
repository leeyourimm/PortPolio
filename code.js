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
"rap7-c1": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "\" ========================================================\n\" 구매오더 품목의 입고수량 반영\n\" ========================================================\nMODIFY ENTITIES OF zr_a20_ekko\n  ENTITY PurchaseOrderItem\n    EXECUTE updateGoodsReceiptWemng\n    FROM VALUE #(\n      (\n        %key-EbelnUUID = group-EbelnUuid\n        %key-Ebelp     = group-Ebelp\n        %param-Delta   = gritem\n        %param-Meins   = group-Meins\n      )\n    )\n  FAILED DATA(failed_po)\n  REPORTED DATA(reported_po)."
}
]
},
"rap7-c2": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "\" ==============================================\n\" 다른 BO인 구매오더의 Action 호출\n\" ==============================================\nMODIFY ENTITIES OF zr_a20_ekko\n  ENTITY PurchaseOrderItem\n    EXECUTE updateGoodsReceiptComplete\n\n    FROM VALUE #(\n      (\n        %tky = VALUE #(\n          EbelnUUID = item-EbelnUUID\n          Ebelp     = item-Ebelp\n        )\n      )\n    )\n\n  FAILED DATA(failed_po)\n  REPORTED DATA(reported_po)."
},
{
"lang": "bdef",
"src": "action ( features : instance )\nsetGoodsReceiptComplete result [1] $self;"
}
]
},
"rap8-c1": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "\" 전표 Header 생성\n\" ============================================================\nMODIFY ENTITIES OF zr_a20_bkpf\n  ENTITY DocumentHeader\n EXECUTE createDocumentHeader\n    FROM VALUE #(\n      (\n        %tky = VALUE #(\n          BelnrUuid = lv_belnr_uuid\n        )\n        %param = VALUE #(\n          BelnrUuid = ls_bkpf-belnr_uuid\n          Belnr     = ls_bkpf-belnr\n          Gjahr     = ls_bkpf-gjahr\n          Blart     = ls_bkpf-blart\n          Bldat     = ls_bkpf-bldat\n          Budat     = ls_bkpf-budat\n          Cpudt     = ls_bkpf-cpudt\n          Bktxt     = ls_bkpf-bktxt\n          Waers     = ls_bkpf-waers\n          Awtyp     = ls_bkpf-awtyp\n          Awkey     = ls_bkpf-awkey\n          StblgUuid = ls_bkpf-stblg_uuid\n        )\n      )\n    )\n    FAILED DATA(failed_bkpf)\n    REPORTED DATA(reported_bkpf)."
}
]
},
"rap8-c2": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "\" ==========================================================\n\" 전표 Item 생성\n\" ==========================================================\nMODIFY ENTITIES OF zr_a20_bkpf\n  ENTITY DocumentItem\n    EXECUTE createDocumentItem\n    FROM VALUE #(\n      (\n        %tky = VALUE #(\n          BelnrUuid = iv_belnr_uuid\n          Buzei     = ls_bseg-buzei\n        )\n        %param = VALUE #(\n          Buzei      = ls_bseg-buzei\n          Bschl      = ls_bseg-bschl\n          Koart      = ls_bseg-koart\n          Shkzg      = ls_bseg-shkzg\n          HkontUuid  = ls_bseg-hkont_uuid\n          Wrbtr      = ls_bseg-wrbtr\n          Waers      = is_gr_item-Waers\n          Sgtxt      = ls_bseg-sgtxt\n          Werks      = ls_bseg-werks\n          LifUuid    = ls_bseg-lif_uuid\n          MatUuid    = ls_bseg-mat_uuid\n        )\n      )\n    )\n    FAILED DATA(failed_bkpf)\n    REPORTED DATA(reported_bkpf)."
}
]
},
"rap8-c3": {
"lang": "bdef",
"panes": [
{
"lang": "bdef",
"src": "action createDocumentHeader\n  parameter ZA_A20_DOCUMENT_HEADER;"
}
]
},
"rap8-c4": {
"lang": "bdef",
"panes": [
{
"lang": "bdef",
"src": "action createDocumentItem\n  parameter ZA_A20_DOCUMENT_ITEM;"
}
]
},
"sd2-c1": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "  \" 입력한 값 변경\nWHEN 'PO_CNANGE'.\n  \" DB에 반영된 건을 저장하는 로직을 실행시기키 위한 bool 세팅\n  gv_after_edit  = abap_true.\n\n\n  \" 수정 모드로\n  IF gv_edit = abap_false.\n    gv_edit = abap_true.\n\n    CALL METHOD go_alv_grid->set_ready_for_input\n      EXPORTING\n        i_ready_for_input = 1.\n    \" 조회 모드로\n  ELSEIF gv_edit = abap_true.\n    gv_edit = abap_false.\n\n    CALL METHOD go_alv_grid->set_ready_for_input\n      EXPORTING\n        i_ready_for_input = 0.\n\n  ENDIF."
}
]
},
"sd2-c3": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "  \" 작년도 판매량 기준 자동 채움\nWHEN gv_op3.\n  IF gv_before_dynnr = 0100.\n    PERFORM popup_to_confirm USING sy-ucomm\n                                   gv_ok.\n    PERFORM fill_auto_plan_qty_last_0100.\n    PERFORM refresh_alv_0100.\n\n  ELSEIF gv_before_dynnr = 0140.\n    \" 전체 제품의 작년 달별 판매량 계산\n    PERFORM sum_lastmonth_qua.\n    PERFORM popup_to_confirm USING sy-ucomm\n                             gv_ok.\n    PERFORM fill_auto_plan_qty_last_0140.\n    PERFORM refresh_alv_0140.\n  ENDIF.\n\n  \" 전년도 판매량 + PIR\nWHEN gv_op5.\n\n  PERFORM select_pir_data.\n\n  IF gv_before_dynnr = 0100.\n    PERFORM popup_to_confirm USING sy-ucomm\n                       gv_ok.\n    PERFORM fill_auto_plan_qty_la_pir_0100.\n    PERFORM refresh_alv_0100.\n\n  ELSEIF gv_before_dynnr = 0140.\n\n    \" 전체 제품의 작년 달별 판매량 계산\n    PERFORM sum_lastmonth_qua.\n\n    IF sy-ucomm IS NOT INITIAL.\n      PERFORM popup_to_confirm USING sy-ucomm\n                                     gv_ok.\n    ENDIF.\n    PERFORM fill_auto_plan_qty_la_pir_0140.\n    PERFORM refresh_alv_0140.\n  ENDIF."
}
]
},
"sd2-c4": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "DATA: lv_year      TYPE n LENGTH 4,\n      lv_year_from TYPE sydatum,\n      lv_year_to   TYPE sydatum.\n\nREFRESH gt_layear_sum.\n\nlv_year = sy-datum(4) - 1.\n\nlv_year_from = |{ lv_year }0101|.\nlv_year_to   = |{ lv_year }1231|.\n\nSELECT matnr,\n       substring( audat, 5, 2 ) AS month,\n       vkorg,\n       kwmeng\n  FROM zcds_d3_sd_0014\n  INTO CORRESPONDING FIELDS OF TABLE @gt_layear_sum.\n\nSORT gt_layear_sum BY month matnr vkorg."
}
]
},
"sd3-c1": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "*--------------------------------------------------------------------*\n* 상단에 docking container, doc 생성\n*--------------------------------------------------------------------*\n  IF go_dock_top IS INITIAL.\n    CREATE OBJECT go_dock_top\n      EXPORTING\n        repid     = sy-repid \" REPORT TO WHICH THIS DOCKING CONTROL IS LINKED\n        dynnr     = sy-dynnr \" SCREEN TO WHICH THIS DOCKING CONTROL IS LINKED\n        side      = cl_gui_docking_container=>dock_at_top\n        extension = 65               \" Control Extension\n      EXCEPTIONS\n        OTHERS    = 1.\n    IF sy-subrc <> 0.\n      MESSAGE e019. \" 019: &1 Docking Container 생성에 실패하였습니다.\n    ENDIF.\n\n    CREATE OBJECT go_doc\n      EXPORTING\n        style      = 'ALV_GRID'\n        no_margins = 'X'.\n  ENDIF.\n\n  PERFORM set_document_data_0100."
}
]
},
"sd4-c1": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "\" 팝업 확인을 눌렀을 때 실행\nCHECK gv_ok IS NOT INITIAL.\n\n\" 저장할 데이터가 있을 때 실행(팝업을 위해)\nCHECK gv_not_initail IS NOT INITIAL.\n\n\" 저장할 데이터가 있을 때 실행(저장을 위해)\nCHECK gv_save_bool IS NOT INITIAL.\n\nCLEAR gv_save_bool.\nCLEAR gv_ok.\n\nLOOP AT gt_bill_header INTO gs_bill_header.\n\n  CLEAR lv_vbeln_so.\n\n  SELECT SINGLE vbeln_so\n    FROM ztd3sd0010\n   WHERE vbeln_so EQ @gs_bill_header-vbeln_so\n    INTO @lv_vbeln_so.\n\n  IF lv_vbeln_so IS NOT INITIAL.\n    lv_count += 1.\n  ENDIF.\n\nENDLOOP.\n\n\" 대금청구에 해당하는 판매오더가 있으면 돌아가기\nIF lv_vbeln_so NE 0.\n\n  \" 106 : 해당 판매오더가 이미 존재합니다. 다시 한번 확인해주세요.\n  MESSAGE s106 DISPLAY LIKE 'A'.\n  EXIT.\n\nELSE."
}
]
},
"sd4-c3": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "\" 세금계산서 헤더 저장\nINSERT ztd3fi0013 FROM TABLE @gt_tax_header.\nIF sy-subrc <> 0.\n  ROLLBACK WORK.\n  \" 저장에 실패하였습니다.\n  MESSAGE s025 DISPLAY LIKE 'A'.\n  EXIT.\nENDIF.\n\n\" 세금계산서 아이템 저장\nINSERT ztd3fi0014 FROM TABLE @gt_tax_item.\nIF sy-subrc <> 0.\n  ROLLBACK WORK.\n  \" 저장에 실패하였습니다.\n  MESSAGE s025 DISPLAY LIKE 'A'.\n  EXIT.\nENDIF.\n\nCOMMIT WORK.\n\nMESSAGE s023. \" 저장되었습니다."
}
]
},
"sd4-c5": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "\" 저장 버튼을 누른 후, 여러 번 누르는 것을 막기 위한 클리어\nREFRESH gt_statement.\nREFRESH gt_bill_header.\nREFRESH gt_bill_item.\nREFRESH gt_tax_header.\nREFRESH gt_tax_item.\n\n\n\" 다시 데이터 재조회 하기 위해\nCLEAR gv_start."
}
]
},
"sd4-c6": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "CALL METHOD go_alv_grid->get_selected_rows\n  IMPORTING\n    et_index_rows = lt_rows.\n\n\n\nIF lines( lt_rows ) GT 1.\n  \" 데이터를 1건만 선택해 주세요\n  MESSAGE s079 DISPLAY LIKE 'W'.\n  RETURN.\nELSEIF lines( lt_rows ) EQ 0.\n  \" 데이터를 선택해 주세요\n  MESSAGE s080 DISPLAY LIKE 'W'.\n  RETURN.\nENDIF.\n\nREAD TABLE lt_rows INTO ls_row INDEX 1.\n\nREAD TABLE gt_display1 INTO gs_display1 INDEX ls_row-index.\n\nIF gs_display1-vbeln IS INITIAL.\n  \" 아직 청구되지 않은 건입니다.\n  MESSAGE s086 DISPLAY LIKE 'A'.\n  RETURN.\nENDIF.\n\n\nSUBMIT zrd3sd0010\n  WITH so_vb        = gs_display1-vbeln\n  WITH so_vb-sign   = 'I'\n  WITH so_vb-option = 'EQ'\n  WITH pa_auto   = abap_true\n   AND RETURN."
}
]
},
"sd4-c7": {
"lang": "cds",
"panes": [
{
"lang": "cds",
"src": "@AccessControl.authorizationCheck: #NOT_REQUIRED\n@EndUserText.label: '[D3] 견적 기준 가격변동 체크'\ndefine view entity ZCDS_D3_SD_0024\n  as select from ztd3sd0012 as Header\n    inner join ztd3sd0013 as Item\n      on Header.vbeln = Item.vbeln\n    inner join ztd3sd0007 as SoI\n      on  SoI.vgbel  = Item.vbeln\n      and SoI.vgposn = Item.posnr\n    left outer join ztd3sd0010 as Bill\n      on Bill.vbeln_so = SoI.vbeln\n    inner join ztd3sd0016 as PriceHist\n      on Item.price_id = PriceHist.price_id\n{\n  key Header.vbeln              as Vbeln,\n  key SoI.vbeln                 as Vbein_so,\n  key Bill.vbeln                as Bill,\n  key Item.posnr                as Posnr,\n  key PriceHist.prc_hist_no     as PriceHistoryNo,\n\n      Item.price_id             as PriceId,\n\n      Header.angdt              as QuotationStartDate,  // 견적 시작일\n      PriceHist.erdat           as ChangedDate,         // 가격 변동일\n      $session.system_date      as BillingCheckDate,    // 대금청구일\n\n      PriceHist.kbetr_old       as OldPrice,\n      PriceHist.kbetr_new       as NewPrice,\n      PriceHist.waers           as Waers\n}\nwhere PriceHist.erdat between Header.angdt and $session.system_date\n  and Bill.vbeln_so is initial"
}
]
},
"sd5-c1": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "LOOP AT gt_statement INTO gs_statement\n  WHERE vbeln EQ gs_billing-vbeln_so.\n\n  \" 고객 채권 발생 라인 (고객 차변)\n  \" 전기키 마스터 기준: 01 = 고객 차변(매출채권 발생)\n  IF gs_statement-koart = 'D'\n     AND gs_statement-bschl = 1.\n\n    lv_ar_amt += gs_statement-wrbtr.\n\n  ENDIF.\n\n  \" 고객 입금/반제 라인 (고객 대변)\n  \" 전기키 마스터 기준: 11 = 고객 대변(입금/반제)\n  IF gs_statement-koart = 'D'\n     AND gs_statement-bschl = 11.\n\n    lv_clr_amt += gs_statement-wrbtr.\n\n  ENDIF.\n\n\n  \" 미수잔액 계산\n  lv_rem_amt = lv_ar_amt - lv_clr_amt.\n  IF lv_rem_amt < 0.\n    lv_rem_amt = 0.\n  ENDIF.\n\n  gs_billing-get_price = lv_clr_amt.    \" 받은 금액 세팅\n  gs_billing-ng_price  = lv_rem_amt.    \" 미수 금액 세팅\n\n  CHECK gs_billing-re_date LT sy-datum."
}
]
},
"sd6-c1": {
"lang": "abap",
"panes": [
{
"lang": "abap",
"src": "  READ TABLE gt_tax_header INTO gs_tax_header INDEX p_row_id-index.\n\n*     출력용 ITAB에서 선택한 행에 대한 정보를 찾지 못할 경우 중단한다.\n  IF sy-subrc NE 0.\n    RETURN.\n  ENDIF.\n\n*     선택한 컬럼명의 필드명에 따라 로직을 구현한다.\n  CASE p_column_id-fieldname.\n    WHEN 'BELNR'. \" 전표번호\n      SET PARAMETER ID 'BUK' FIELD gs_tax_header-bukrs.   \" 회사코드\n      SET PARAMETER ID 'GJR' FIELD gs_tax_header-gjahr.   \" 회계연도\n      SET PARAMETER ID 'BLN' FIELD gs_tax_header-belnr.   \" 전표번호\n\n      CALL TRANSACTION 'ZRD3FI0001' AND SKIP FIRST SCREEN.  \" 전표 단일 조회 프로그램 호출\n\n  ENDCASE."
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
