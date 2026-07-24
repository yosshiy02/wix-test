' HD_ORIGIN_ACCESS_AUTO_AI_PIPELINE_20260718_START
Private Sub RunAutomaticAiPipeline( _
    ByVal ocrId As Long, _
    ByVal ocrText As String, _
    Optional ByVal showMessage As Boolean = False _
)
    On Error GoTo EH

    Dim db As Object
    Dim rs As Object
    Dim firstRequest As String
    Dim firstResponse As String
    Dim specialistRequest As String
    Dim specialistResponse As String
    Dim companyCode As String
    Dim documentTypeCode As String
    Dim analysisSystemCode As String
    Dim specialistRouteCode As String
    Dim reasonText As String
    Dim warningsJson As String
    Dim modelName As String
    Dim promptVersion As String
    Dim confidenceValue As Double
    Dim companyId As Variant
    Dim documentTypeId As Variant
    Dim specialistId As Variant
    Dim needsReview As Boolean
    Dim transactionStarted As Boolean

    If ocrId < 1 Then Exit Sub
    If Len(Trim$(ocrText)) = 0 Then Exit Sub

    Set db = CurrentDb

    If Nz(DLookup("[AI判定済み]", "[AI一次判定テーブル]", "[OCR_ID]=" & CStr(ocrId)), False) = True Then
        Set rs = db.OpenRecordset( _
            "SELECT TOP 1 " & _
            "P.[会社ID],P.[文書種別ID],P.[専門解析ID]," & _
            "S.[専門解析コード名] " & _
            "FROM [AI一次判定テーブル] AS P " & _
            "INNER JOIN [専門解析マスタテーブル] AS S " & _
            "ON P.[専門解析ID]=S.[専門解析ID] " & _
            "WHERE P.[OCR_ID]=" & CStr(ocrId) & _
            " ORDER BY P.[一次判定ID] DESC;", _
            2 _
        )

        If rs.EOF Then
            Err.Raise vbObjectError + 1700, _
                "RunAutomaticAiPipeline", _
                "既存一次判定を取得できません。"
        End If

        companyId = rs.Fields("会社ID").value
        documentTypeId = rs.Fields("文書種別ID").value
        specialistId = rs.Fields("専門解析ID").value
        analysisSystemCode = Nz(rs.Fields("専門解析コード名").value, "")

        rs.Close
        Set rs = Nothing
    Else
        firstRequest = _
            "{" & _
            """access_ocr_id"":" & CStr(ocrId) & "," & _
            """ocr_text"":""" & JsonEscape(ocrText) & """," & _
            """candidate_companies"":" & BuildFirstAiCompanyCandidatesJson() & "," & _
            """candidate_document_types"":" & BuildFirstAiDocumentTypeCandidatesJson() & "," & _
            """candidate_specialists"":" & BuildFirstAiSpecialistCandidatesJson() & _
            "}"

        firstResponse = HttpPostJson( _
            HD_BASE_URL & "/api/payment-documents/access-ai/first-decision", _
            firstRequest _
        )

        If Not JsonBoolean(firstResponse, "ok") Then
            Err.Raise vbObjectError + 1701, _
                "RunAutomaticAiPipeline", _
                JsonString(firstResponse, "error")
        End If

        companyCode = JsonString(firstResponse, "company_code")
        documentTypeCode = JsonString(firstResponse, "document_type_code")
        analysisSystemCode = JsonString(firstResponse, "analysis_system_code")
        reasonText = JsonString(firstResponse, "reason")
        warningsJson = JsonString(firstResponse, "warnings_json")
        modelName = JsonString(firstResponse, "model")
        promptVersion = JsonString(firstResponse, "prompt_version")
        confidenceValue = JsonDecimalValue(firstResponse, "confidence")
        needsReview = JsonBoolean(firstResponse, "needs_review")

        companyId = DLookup( _
            "[会社ID]", _
            "[会社マスタテーブル]", _
            "[会社コード]='" & SqlQuote(companyCode) & "'" _
        )

        documentTypeId = DLookup( _
            "[文書種別ID]", _
            "[文書種別マスタテーブル]", _
            "[文書種別コード]='" & SqlQuote(documentTypeCode) & "'" _
        )

        specialistId = DLookup( _
            "[専門解析ID]", _
            "[専門解析マスタテーブル]", _
            "[専門解析コード名]='" & SqlQuote(analysisSystemCode) & "'" _
        )

        If IsNull(companyId) Then
            Err.Raise vbObjectError + 1702, _
                "RunAutomaticAiPipeline", _
                "会社コードがマスタにありません: " & companyCode
        End If

        If IsNull(documentTypeId) Then
            Err.Raise vbObjectError + 1703, _
                "RunAutomaticAiPipeline", _
                "文書種別コードがマスタにありません: " & documentTypeCode
        End If

        If IsNull(specialistId) Then
            Err.Raise vbObjectError + 1704, _
                "RunAutomaticAiPipeline", _
                "専門解析コードがマスタにありません: " & analysisSystemCode
        End If

        DBEngine.Workspaces(0).BeginTrans
        transactionStarted = True

        SaveFirstAiDecision _
            db, _
            ocrId, _
            CLng(companyId), _
            CLng(documentTypeId), _
            CLng(specialistId), _
            confidenceValue, _
            reasonText, _
            warningsJson, _
            firstResponse, _
            modelName, _
            promptVersion

        SaveFirstAiLog _
            db, _
            ocrId, _
            CLng(specialistId), _
            Len(ocrText), _
            firstResponse, _
            ""

        Set rs = db.OpenRecordset( _
            "SELECT * FROM [OCRテーブル] " & _
            "WHERE [OCR_ID]=" & CStr(ocrId), _
            2 _
        )

        If Not rs.EOF Then
            rs.Edit
            rs.Fields("会社ID").value = CLng(companyId)
            rs.Fields("文書種別ID").value = CLng(documentTypeId)
            rs.Fields("更新日時").value = Now()
            rs.Update
        End If

        rs.Close
        Set rs = Nothing

        DBEngine.Workspaces(0).CommitTrans
        transactionStarted = False
    End If

    specialistRouteCode = Replace( _
        LCase$(Trim$(analysisSystemCode)), _
        "_analysis", _
        "" _
    )

    specialistRequest = _
        "{" & _
        """access_ocr_id"":" & CStr(ocrId) & "," & _
        """ocr_text"":""" & JsonEscape(ocrText) & """," & _
        """specialist_route_code"":""" & JsonEscape(specialistRouteCode) & """," & _
        """analysis_system_code"":""" & JsonEscape(analysisSystemCode) & """" & _
        "}"

    specialistResponse = HttpPostJson( _
        HD_BASE_URL & "/api/payment-documents/access-ai-specialist", _
        specialistRequest _
    )

    If Not JsonBoolean(specialistResponse, "ok") Then
        Err.Raise vbObjectError + 1705, _
            "RunAutomaticAiPipeline", _
            JsonString(specialistResponse, "error")
    End If

    SaveAutomaticSpecialistResult _
        db, _
        ocrId, _
        CLng(specialistId), _
        analysisSystemCode, _
        specialistResponse, _
        needsReview

   SaveFirstAiLog _
    db, _
    ocrId, _
    CLng(specialistId), _
    Len(ocrText), _
    specialistResponse, _
    "", _
    "専門解析"

    If showMessage Then
        MsgBox _
            "OCRから専門解析・下書き保存まで完了しました。" & _
            vbCrLf & "OCR_ID: " & CStr(ocrId) & _
            vbCrLf & "専門解析: " & analysisSystemCode, _
            vbInformation, _
            "自動AI解析"
    End If

CLEANUP:
    On Error Resume Next

    If Not rs Is Nothing Then rs.Close

    Set rs = Nothing
    Set db = Nothing

    On Error GoTo 0
    Exit Sub

EH:
    Dim pipelineError As String

    pipelineError = Err.Description

    If transactionStarted Then
        On Error Resume Next
        DBEngine.Workspaces(0).Rollback
        On Error GoTo 0
    End If

    On Error Resume Next

    If Not db Is Nothing Then
        SaveFirstAiLog _
            db, _
            ocrId, _
            0, _
            Len(ocrText), _
            specialistResponse, _
            pipelineError
    End If

    Me.txt状態 = _
        "自動AIパイプラインエラー OCR_ID " & _
        CStr(ocrId) & ": " & pipelineError

    On Error GoTo 0

    If showMessage Then
        MsgBox pipelineError, vbCritical, "自動AI解析"
    End If

    Resume CLEANUP
End Sub

