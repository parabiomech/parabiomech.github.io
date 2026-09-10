"""
==============================================================================
  정해륜 CV PDF 생성 스크립트
  - assets/json/resume.json 데이터를 읽어 학술 스타일 PDF를 생성합니다.
  - 실행: python generate_cv_pdf.py
  - 출력: cv_HaeryunJung.pdf (프로젝트 루트에 생성)
  - 폰트: assets/fonts/NanumGothic (한글 지원)
==============================================================================
"""
import json
from fpdf import FPDF
from pathlib import Path
import shutil


# ============================================================================
#  1. 데이터 불러오기 (resume.json)
#     - 내용을 수정하려면 assets/json/resume.json 파일을 직접 편집하면 됩니다.
# ============================================================================
with open("assets/json/resume.json", "r", encoding="utf-8") as f:
    data = json.load(f)


# ============================================================================
#  2. PDF 클래스 정의
#     - 레이아웃, 폰트, 섹션 스타일 등을 여기서 조정합니다.
# ============================================================================
class CVPDF(FPDF):
    def __init__(self):
        super().__init__(format="A4")
        # --- 메인 폰트: Times New Roman (학술 CV에 적합한 세리프 폰트) ---
        # "Times"는 fpdf2 내장 코어폰트명과 겹치므로 "TimesNR"로 등록
        self.add_font("TimesNR", "", r"C:\Windows\Fonts\times.ttf")
        self.add_font("TimesNR", "B", r"C:\Windows\Fonts\timesbd.ttf")
        # --- 한글 폴백 폰트: 나눔고딕 (한글 문자가 나올 때 자동 사용) ---
        self.add_font("Nanum", "", "assets/fonts/NanumGothic-Regular.ttf")
        self.add_font("Nanum", "B", "assets/fonts/NanumGothic-Bold.ttf")
        self.set_fallback_fonts(["Nanum"])
        # --- 페이지 하단 자동 줄바꿈 여백 (mm) ---
        self.set_auto_page_break(auto=True, margin=15)

    # -----------------------------------------------------------------------
    #  상단 헤더: 이름 + 연락처
    # -----------------------------------------------------------------------
    def header_section(self):
        basics = data["basics"]

        # 이름 (굵게, 22pt, 가운데 정렬)
        self.set_font("TimesNR", "B", 22)
        self.cell(0, 12, basics["name"], ln=True, align="C")

        # 연락처 한 줄 (이메일 | 전화 | GitHub)
        # - 이메일과 GitHub에는 클릭 가능한 링크를 걸어줍니다.
        self.set_font("TimesNR", "", 9)
        contact_parts = []
        if basics.get("email"):
            contact_parts.append(basics["email"])
        if basics.get("phone"):
            contact_parts.append(basics["phone"])
        # GitHub 프로필 URL
        for profile in basics.get("profiles", []):
            if profile.get("network", "").lower() == "github":
                contact_parts.append(f'GitHub: {profile["username"]}')
        contact_line = "  |  ".join(contact_parts)

        # 연락처 텍스트를 가운데 정렬로 출력
        line_w = self.get_string_width(contact_line)
        x_start = (self.w - line_w) / 2
        self.set_x(x_start)

        # 각 파트를 개별 출력하여 이메일/GitHub에 링크 적용
        for i, part in enumerate(contact_parts):
            if i > 0:
                self.cell(self.get_string_width("  |  "), 6, "  |  ")
            if part == basics.get("email"):
                # 이메일 클릭 → mailto 링크
                w = self.get_string_width(part)
                self.set_text_color(0, 0, 180)  # 파란색
                self.cell(w, 6, part, link=f'mailto:{basics["email"]}')
                self.set_text_color(0, 0, 0)
            elif part.startswith("GitHub:"):
                # GitHub 클릭 → 프로필 링크
                gh_url = next(
                    p["url"] for p in basics["profiles"]
                    if p.get("network", "").lower() == "github"
                )
                w = self.get_string_width(part)
                self.set_text_color(0, 0, 180)  # 파란색
                self.cell(w, 6, part, link=gh_url)
                self.set_text_color(0, 0, 0)
            else:
                # 전화번호 등 일반 텍스트
                self.cell(self.get_string_width(part), 6, part)
        self.ln(6)
        self.ln(2)  # 헤더 아래 여백

    # -----------------------------------------------------------------------
    #  섹션 제목 (예: EDUCATION, EXPERIENCE 등)
    #  - 대문자로 표시되며 아래 구분선이 그어집니다.
    # -----------------------------------------------------------------------
    def section_title(self, title):
        self.set_font("TimesNR", "B", 12)       # 제목 폰트 크기
        self.set_text_color(0, 0, 0)           # 검정색
        self.cell(0, 8, title.upper(), ln=True)
        # 구분선 그리기
        self.set_draw_color(40, 40, 40)        # 선 색상 (짙은 회색)
        self.set_line_width(0.4)               # 선 두께
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)  # 구분선 아래 여백

    # -----------------------------------------------------------------------
    #  날짜가 있는 항목 (학력, 경력, 프로젝트 등)
    #  - 왼쪽: 직책/학위명 + 기관명
    #  - 오른쪽: 기간
    #  - 아래: 요약 + 세부사항(불릿 리스트)
    # -----------------------------------------------------------------------
    def entry_with_date(self, title, subtitle, location, date_str,
                        summary="", highlights=None):
        # 제목(굵게) + 날짜(오른쪽 정렬)를 같은 줄에 배치
        self.set_font("TimesNR", "B", 10)
        title_w = self.w - self.l_margin - self.r_margin - 50  # 날짜 영역 50mm 확보
        if self.will_page_break(20):
            self.add_page()
        start_y = self.get_y()
        self.multi_cell(title_w, 5, title, new_x="LMARGIN", new_y="NEXT", align="L")
        end_y = self.get_y()
        self.set_xy(self.w - self.r_margin - 50, start_y)
        self.set_font("TimesNR", "", 9)
        self.cell(50, 5, date_str, ln=True, align="R")
        self.set_xy(self.l_margin, end_y)

        # 기관명 + 위치 (예: "국민대학교, 서울")
        if subtitle or location:
            self.set_font("TimesNR", "", 9)
            line = ""
            if subtitle:
                line = subtitle
            if location:
                line = f"{line}, {location}" if line else location
            self.cell(0, 5, line, ln=True)

        # 요약 설명
        if summary:
            self.set_font("TimesNR", "", 9)
            self.multi_cell(0, 4.5, summary)

        # 세부사항 (불릿 포인트 리스트)
        if highlights:
            self.set_font("TimesNR", "", 9)
            for h in highlights:
                self.set_x(self.l_margin + 4)        # 들여쓰기
                self.cell(4, 4.5, chr(8226), ln=False)  # ? 불릿 문자
                self.multi_cell(0, 4.5, f" {h}", markdown=True)

        self.ln(2)  # 항목 간 여백

    # -----------------------------------------------------------------------
    #  단순 항목 (제목 + 선택적 부제목)
    # -----------------------------------------------------------------------
    def simple_entry(self, title, subtitle=""):
        self.set_font("TimesNR", "B", 10)
        self.cell(0, 5, title, ln=True)
        if subtitle:
            self.set_font("TimesNR", "", 9)
            self.multi_cell(0, 4.5, subtitle)
        self.ln(1)

    # -----------------------------------------------------------------------
    #  불릿 한 줄 (? 텍스트)
    # -----------------------------------------------------------------------
    def bullet_line(self, text):
        self.set_font("TimesNR", "", 9)
        self.set_x(self.l_margin + 4)
        self.cell(4, 4.5, chr(8226), ln=False)
        self.multi_cell(0, 4.5, f" {text}")


# ============================================================================
#  3. 유틸리티 함수
# ============================================================================
def format_date_range(start, end):
    """
    ISO 날짜 문자열을 'YYYY.MM - YYYY.MM' 또는 'YYYY.MM - Present' 형식으로 변환합니다.
    예: ("2015-03-01", "2017-02-28") → "2015.03 - 2017.02"
        ("2023-08-01", "")           → "2023.08 - Present"
    """
    def fmt(d):
        if not d:
            return ""
        parts = d.split("-")
        return f"{parts[0]}.{parts[1]}" if len(parts) >= 2 else parts[0]

    if not start and not end:
        return ""
    s = fmt(start)
    if not end:
        e = "Present"  # 종료일이 없으면 '현재'
    else:
        e = fmt(end)
    if s == e:
        return s  # 시작/종료가 같으면 하나만 표시
    return f"{s} - {e}" if s else e


# ============================================================================
#  4. PDF 생성 - 각 섹션 순서대로 추가
#     - 섹션 순서를 바꾸려면 아래 블록 순서를 변경하면 됩니다.
#     - 섹션을 삭제하려면 해당 블록을 주석 처리(#)하면 됩니다.
# ============================================================================
pdf = CVPDF()
pdf.add_page()

# --- 상단 헤더 (이름 + 연락처) ---
pdf.header_section()

# ---- (1) 학력 (EDUCATION) ----
pdf.section_title("Education")
for edu in data["education"]:
    date_str = format_date_range(edu.get("startDate", ""), edu.get("endDate", ""))
    # 학위명 조합: "석사 in 전공분야" 형식
    title = f"{edu['studyType']} in {edu['area']}" if edu.get("area") else edu.get("studyType", "")
    pdf.entry_with_date(
        title=title,
        subtitle=edu.get("institution", ""),   # 학교명
        location=edu.get("location", ""),       # 위치
        date_str=date_str,                      # 기간
        highlights=edu.get("highlights", []),   # 세부사항
    )

# ---- (2) 경력 (WORK EXPERIENCE) ----
pdf.section_title("Work Experience")
for job in data["work"]:
    date_str = format_date_range(job.get("startDate", ""), job.get("endDate", ""))
    pdf.entry_with_date(
        title=job.get("position", ""),       # 직책
        subtitle=job.get("name", ""),        # 기관명
        location=job.get("location", ""),    # 위치
        date_str=date_str,                   # 기간
        summary=job.get("summary", ""),      # 업무 요약
        highlights=job.get("highlights", []),  # 주요 성과
    )

# ---- (3) 논문 (PUBLICATIONS) ----
# Han CV 스타일: 번호 + 저자(본인 밑줄) + 제목(이탤릭) + 저널 + [Paper] 링크
if data.get("publications"):
    pdf.section_title("Publications")

    # --- Journal Papers (SCIE / KCI) ---
    journals = [p for p in data["publications"] if "Proceeding" not in p.get("summary", "") and p.get("type") != "conference"]
    proceedings = [p for p in data["publications"] if "Proceeding" in p.get("summary", "") or p.get("type") == "conference"]

    if journals:
        pdf.set_font("TimesNR", "B", 10)
        pdf.cell(0, 6, "Journal Papers", ln=True)
        pdf.ln(1)
        for idx, pub in enumerate(journals, 1):
            if pdf.will_page_break(32):
                pdf.add_page()
            pdf.set_font("TimesNR", "", 9)
            # 번호
            num_str = f"{idx}. "
            pdf.set_x(pdf.l_margin + 2)
            pdf.cell(pdf.get_string_width(num_str), 4.5, num_str)

            # 저자 목록 (H.R. Jung 볼드 강조)
            authors = pub.get("authors", "")
            author_list = [a.strip() for a in authors.split(",")]
            x_pos = pdf.get_x()
            for ai, author in enumerate(author_list):
                if ai > 0:
                    pdf.set_font("TimesNR", "", 9)
                    pdf.cell(pdf.get_string_width(", "), 4.5, ", ")
                # 본인 이름 볼드 처리
                if "H.R. Jung" in author or "H.R.Jung" in author:
                    pdf.set_font("TimesNR", "B", 9)
                else:
                    pdf.set_font("TimesNR", "", 9)
                pdf.cell(pdf.get_string_width(author), 4.5, author)
            pdf.ln(4.5)

            # 제목 (굵게) + 저널명 + 상세정보
            pdf.set_x(pdf.l_margin + 2 + pdf.get_string_width(num_str))
            pdf.set_font("TimesNR", "B", 9)
            # 제목이 길 수 있으므로 multi_cell 사용
            title_x = pdf.get_x()
            pdf.multi_cell(pdf.w - pdf.r_margin - title_x, 4.5,
                           f'"{pub["name"]}"')

            # 저널명, 날짜, 상세정보
            pdf.set_x(pdf.l_margin + 2 + pdf.get_string_width(num_str))
            pdf.set_font("TimesNR", "", 9)
            detail = pub["publisher"] + (f", {pub['releaseDate'][:4]}" if pub.get("releaseDate") else "")
            summary = pub.get("summary", "")
            if summary:
                detail += f' | {summary}'
            pdf.multi_cell(pdf.w - pdf.r_margin - pdf.get_x(), 4.5, detail)

            # [Paper] 링크 (URL이 있는 경우만)
            if pub.get("url"):
                pdf.set_x(pdf.l_margin + 2 + pdf.get_string_width(num_str))
                pdf.set_font("TimesNR", "B", 9)
                pdf.set_text_color(0, 0, 180)
                pdf.cell(pdf.get_string_width("[Paper]"), 4.5, "[Paper]",
                         link=pub["url"])
                pdf.set_text_color(0, 0, 0)
                pdf.ln(4.5)

            pdf.ln(2)

    # --- Conference Proceedings ---
    if proceedings:
        pdf.set_font("TimesNR", "B", 10)
        pdf.cell(0, 6, "Conference Papers & Submissions", ln=True)
        pdf.ln(1)
        for idx, pub in enumerate(proceedings, 1):
            if pdf.will_page_break(32):
                pdf.add_page()
            pdf.set_font("TimesNR", "", 9)
            num_str = f"{idx}. "
            pdf.set_x(pdf.l_margin + 2)
            pdf.cell(pdf.get_string_width(num_str), 4.5, num_str)

            # 저자 목록 (H.R. Jung 볼드 강조)
            authors = pub.get("authors", "")
            author_list = [a.strip() for a in authors.split(",")]
            for ai, author in enumerate(author_list):
                if ai > 0:
                    pdf.set_font("TimesNR", "", 9)
                    pdf.cell(pdf.get_string_width(", "), 4.5, ", ")
                if "H.R. Jung" in author or "H.R.Jung" in author:
                    pdf.set_font("TimesNR", "B", 9)
                else:
                    pdf.set_font("TimesNR", "", 9)
                pdf.cell(pdf.get_string_width(author), 4.5, author)
            pdf.ln(4.5)

            # 제목 (굵게)
            pdf.set_x(pdf.l_margin + 2 + pdf.get_string_width(num_str))
            pdf.set_font("TimesNR", "B", 9)
            title_x = pdf.get_x()
            pdf.multi_cell(pdf.w - pdf.r_margin - title_x, 4.5,
                           f'"{pub["name"]}"')

            # 학회명, 날짜, 상세정보
            pdf.set_x(pdf.l_margin + 2 + pdf.get_string_width(num_str))
            pdf.set_font("TimesNR", "", 9)
            detail = pub["publisher"] + (f", {pub['releaseDate'][:4]}" if pub.get("releaseDate") else "")
            summary = pub.get("summary", "")
            if summary:
                detail += f' | {summary}'
            pdf.multi_cell(pdf.w - pdf.r_margin - pdf.get_x(), 4.5, detail)

            # [Paper] 링크
            if pub.get("url"):
                pdf.set_x(pdf.l_margin + 2 + pdf.get_string_width(num_str))
                pdf.set_font("TimesNR", "B", 9)
                pdf.set_text_color(0, 0, 180)
                pdf.cell(pdf.get_string_width("[Paper]"), 4.5, "[Paper]",
                         link=pub["url"])
                pdf.set_text_color(0, 0, 0)
                pdf.ln(4.5)

            pdf.ln(2)

# ---- (4) 연구 경험 (RESEARCH EXPERIENCE) ----
# 과제명, 지원기관 | 참여기관, 기간
if data.get("projects"):
    pdf.section_title("Research Experience")
    for proj in data["projects"]:
        date_str = format_date_range(proj.get("startDate", ""), proj.get("endDate", ""))
        pdf.entry_with_date(
            title=proj.get("name", ""),          # 과제명
            subtitle=proj.get("summary", ""),    # 지원기관 | 참여기관
            location="",
            date_str=date_str,                   # 기간
            highlights=proj.get("highlights", []),
        )

# ---- (5) 기술 (SKILLS) ----
if data.get("skills"):
    pdf.section_title("Skills")
    for skill in data["skills"]:
        kw = ", ".join(skill.get("keywords", []))  # 키워드를 쉼표로 연결
        pdf.set_font("TimesNR", "B", 9)
        pdf.set_x(pdf.l_margin)                     # 왼쪽 여백으로 복귀
        pdf.cell(0, 5, skill["name"], ln=True)     # 스킬 카테고리명 (굵게)
        if kw:
            pdf.set_font("TimesNR", "", 9)
            pdf.set_x(pdf.l_margin + 4)
            pdf.cell(4, 4.5, chr(8226), ln=False)
            pdf.multi_cell(0, 4.5, f" {kw}")       # 세부 키워드 나열
    pdf.ln(2)


# ============================================================================
#  5. PDF 파일 저장
#     - 파일명을 변경하려면 아래 output_path 값을 수정하세요.
# ============================================================================
output_path = "cv_HaeryunJung.pdf"
pdf.output(output_path)
shutil.copy2(output_path, "assets/pdf/cv_HaeryunJung.pdf")
print(f"CV PDF 생성 완료: {output_path}")
