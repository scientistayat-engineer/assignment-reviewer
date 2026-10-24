const pptxgen = require('pptxgenjs');
const { applyTheme } = require('/mnt/skills/public/pptx/scripts/apply_theme.js');
const THEME = { name: 'Gradewise', headFontFace: 'Calibri', bodyFontFace: 'Calibri',
  colors: { dk1:'111827', lt1:'FFFFFF', dk2:'312E81', lt2:'EEF2FF', accent1:'4F46E5', accent2:'7C3AED', accent3:'059669', accent4:'D97706', accent5:'DC2626', accent6:'0EA5E9', hlink:'4F46E5', folHlink:'7C3AED' } };
const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE'; pres.theme = { headFontFace: 'Calibri', bodyFontFace: 'Calibri' };
pres.title = 'Gradewise - AI Assignment Reviewer'; pres.author = 'Anushay Ayat';
const C = pres.SchemeColor;
pres.defineSlideMaster({ title: 'TITLE_ONLY', background: { color: 'F6F7FB' }, margin: [0.5,0.6,0.5,0.6],
  objects: [ { rect: { x:0, y:0, w:13.33, h:0.12, fill:{ color:'4F46E5' } } },
    { text: { text: 'Gradewise  |  AI Assignment Reviewer', options: { x:0.6, y:7.05, w:7, h:0.3, fontSize:10, color:'6B7280', margin:0 } } } ],
  slideNumber: { x: 12.4, y: 7.05, fontSize: 10, color: '6B7280' },
  placeholder: [ { options: { name:'title', type:'title', x:0.6, y:0.35, w:12.1, h:0.8, fontSize:30, bold:true, color:'312E81', margin:0 }, text:'' } ] });
const slide = (t) => { const s = pres.addSlide({ masterName: 'TITLE_ONLY' }); s.addText(t, { x:0.6, y:0.35, w:12.1, h:0.8, fontSize:30, bold:true, color:'312E81', margin:0, valign:'middle', isTextBox:true }); return s; };
const card = (s, x, y, w, h, title, body, color='4F46E5') => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill:{ color:'FFFFFF' }, line:{ color:'E5E7EB', width:1 }, rectRadius:0.12, objectName:'card '+title });
  s.addShape(pres.shapes.RECTANGLE, { x:x+0.25, y:y+0.25, w:0.08, h:0.4, fill:{ color } });
  s.addText(title, { x:x+0.45, y:y+0.2, w:w-0.6, h:0.5, fontSize:16, bold:true, color:'111827', margin:0, isTextBox:true });
  s.addText(body, { x:x+0.25, y:y+0.8, w:w-0.5, h:h-0.95, fontSize:13, color:'4B5563', valign:'top', margin:0, isTextBox:true });
};
// 1 title
let s = pres.addSlide(); s.background = { color:'312E81' };
s.addShape(pres.shapes.OVAL, { x:9.2, y:-1.5, w:6, h:6, fill:{ color:'7C3AED', transparency:55 } });
s.addText('Gradewise', { x:0.9, y:1.9, w:10, h:1, fontSize:54, bold:true, color:'FFFFFF', margin:0, isTextBox:true });
s.addText('AI Assignment Reviewer with a teacher-in-the-loop', { x:0.9, y:2.95, w:10, h:0.6, fontSize:24, color:'C7D2FE', margin:0, isTextBox:true });
s.addText('LangChain  |  LangGraph  |  LangSmith  |  Groq  |  FastAPI', { x:0.9, y:3.8, w:11, h:0.5, fontSize:16, color:'FFFFFF', margin:0, isTextBox:true });
s.addText('Anushay Ayat  -  AI and Data Science, SMIT', { x:0.9, y:6.2, w:10, h:0.4, fontSize:14, color:'C7D2FE', margin:0, isTextBox:true });
// 2 problem
s = slide('Problem and objective');
card(s, 0.6, 1.5, 5.9, 2.4, 'The problem', 'Reviewing many student answers by hand is slow and inconsistent. A plain LLM score is fast, but borderline answers need a human decision.', 'DC2626');
card(s, 6.8, 1.5, 5.9, 2.4, 'The objective', 'Build a workflow that scores answers against a rubric, flags borderline results (4-6 / 10) for a teacher, and records every run in LangSmith.', '059669');
card(s, 0.6, 4.2, 12.1, 2.3, 'What was delivered', 'The teacher\'s terminal script was turned into a complete web application: FastAPI backend, multi-page frontend, SQLite storage, custom rubrics, teacher queue, analytics dashboard, PDF and CSV export, automated tests and LangSmith tracing.', '4F46E5');
// 3 stack
s = slide('Technology stack');
[['Backend','FastAPI, Pydantic, SQLite, ReportLab, pypdf, python-docx'],['AI workflow','LangChain prompt + Groq model with structured output, LangGraph state graph'],['Observability','LangSmith tracing, run names, tags, metadata, teacher feedback'],['Frontend','Vanilla JavaScript single-page app, SVG charts, command palette, English/Urdu, dark mode'],['Quality and security','12 pytest tests, PBKDF2 passwords, signed HttpOnly sessions, input validation, escaped output'],['Demo mode','Offline keyword grader so the app runs without an API key']].forEach((c,i)=>card(s, 0.6+(i%3)*4.1, 1.5+Math.floor(i/3)*2.7, 3.9, 2.4, c[0], c[1], ['4F46E5','7C3AED','059669','0EA5E9','D97706','DC2626'][i]));
// 4 architecture
s = slide('System architecture');
const box = (x,y,w,h,t,sub,col) => { s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x,y,w,h, fill:{ color:col }, line:{ color:col }, rectRadius:0.1 });
  s.addText([{ text:t, options:{ bold:true, fontSize:16, breakLine:true } },{ text:sub, options:{ fontSize:11 } }], { x,y,w,h, color:'FFFFFF', align:'center', valign:'middle', isTextBox:true }); };
box(0.6,2.3,2.6,1.4,'Browser','SPA: review, history, queue, dashboard','4F46E5');
box(4.0,2.3,2.6,1.4,'FastAPI','REST API + static files','7C3AED');
box(7.4,2.3,2.6,1.4,'LangGraph','evaluate, route, teacher_review, finish','312E81');
box(10.6,2.3,2.2,1.4,'Groq LLM','via LangChain','D97706');
box(4.0,4.5,2.6,1.2,'SQLite','questions and reviews','059669');
box(7.4,4.5,2.6,1.2,'LangSmith','traces and teacher feedback','0EA5E9');
const arr=(x,y,w,h)=>s.addShape(pres.shapes.LINE,{ x,y,w,h, line:{ color:'6B7280', width:2.5, endArrowType:'triangle' } });
arr(3.2,3.0,0.8,0); arr(6.6,3.0,0.8,0); arr(10.0,3.0,0.6,0); arr(5.3,3.7,0,0.8); arr(8.7,3.7,0,0.8);
s.addText('Request flow: the browser calls the API, the API runs the graph, the result is stored and returned.', { x:0.6, y:6.2, w:12, h:0.5, fontSize:14, color:'4B5563', margin:0, isTextBox:true });
// 5 workflow
s = slide('LangGraph workflow');
const nd = (x,y,w,t,sub,col) => { s.addShape(pres.shapes.ROUNDED_RECTANGLE,{ x,y,w,h:1.3, fill:{ color:'FFFFFF' }, line:{ color:col, width:2 }, rectRadius:0.1 });
  s.addText([{ text:t, options:{ bold:true, fontSize:15, color:col, breakLine:true } },{ text:sub, options:{ fontSize:11, color:'4B5563' } }],{ x:x+0.1,y,w:w-0.2,h:1.3, align:'center', valign:'middle', isTextBox:true }); };
nd(0.6,2.4,2.2,'START','Answer + rubric','6B7280'); nd(3.3,2.4,2.8,'1. evaluate','LLM scores each criterion, scores are clamped and normalised to /10','4F46E5');
nd(6.6,2.4,2.4,'2. route','Is score 4 to 6?','7C3AED'); nd(9.7,1.5,3,'3a. teacher_review','Flagged for the teacher queue','D97706'); nd(9.7,3.4,3,'3b. finish','Feedback ready','059669');
['0','1','2'].forEach((_,i)=>{}); [[2.8,3.05,3.3,3.05],[6.1,3.05,6.6,3.05],[9.0,2.6,9.7,2.15],[9.0,3.5,9.7,4.05]].forEach(l=>s.addShape(pres.shapes.LINE,{ x:Math.min(l[0],l[2]), y:Math.min(l[1],l[3]), w:Math.abs(l[2]-l[0])||0.01, h:Math.abs(l[3]-l[1])||0.01, flipV:(l[3]<l[1]), line:{ color:'6B7280', width:2, endArrowType:'triangle' } }));
s.addText('The routing rule is the teacher\'s original design; the band is configurable through REVIEW_MIN and REVIEW_MAX.', { x:0.6, y:5.6, w:12, h:0.6, fontSize:14, color:'4B5563', margin:0, isTextBox:true });
// 6 rubric
s = slide('Rubric scoring and routing');
s.addTable([[{text:'Step',options:{bold:true,color:'FFFFFF',fill:{color:'4F46E5'}}},{text:'Rule',options:{bold:true,color:'FFFFFF',fill:{color:'4F46E5'}}}],
 ['Criteria','Each question has 1-8 criteria with its own max points and description'],['Model output','Structured JSON: score + comment per criterion, feedback, one improvement'],['Validation','Scores are clamped to each criterion maximum; missing criteria get 0'],['Normalisation','score = round(total / max_total x 10)'],['Routing','4 to 6 goes to the teacher; everything else is final'],['Safety','Prompt treats the answer as data and ignores instructions inside it']],
 { x:0.6, y:1.5, w:12.1, colW:[2.6,9.5], fontSize:14, border:{ type:'solid', color:'E5E7EB', pt:1 }, fill:{ color:'FFFFFF' }, rowH:0.6, valign:'middle' });
// 7 langsmith
s = slide('LangSmith tracing');
card(s, 0.6, 1.5, 5.9, 3.1, 'What is traced', 'Every review is one named run ("Assignment review") with tags, the student name and question title as metadata, and a unique run id stored with the review. Each node and the Groq call appear as child spans.', '0EA5E9');
card(s, 6.8, 1.5, 5.9, 3.1, 'Teacher feedback loop', 'When the teacher approves or overrides a score, the final score is posted to the same run as feedback (teacher_final_score), so AI and human scores can be compared in LangSmith.', '7C3AED');
s.addShape(pres.shapes.ROUNDED_RECTANGLE,{ x:0.6, y:4.9, w:12.1, h:1.7, fill:{ color:'EEF2FF' }, line:{ color:'4F46E5', width:1, dashType:'dash' }, rectRadius:0.1 });
s.addText('Insert your LangSmith trace screenshot here (smith.langchain.com > Projects > assignment-review)', { x:0.8, y:4.9, w:11.7, h:1.7, fontSize:15, color:'4F46E5', align:'center', valign:'middle', isTextBox:true });
// 8 features
s = slide('Feature overview');
[['Rubric AI scoring','Per-criterion marks and comments'],['Custom questions','Weighted rubrics you define'],['Teacher queue','Approve or override with a note'],['Batch review','CSV or many files, live progress'],['File upload','PDF, DOCX and TXT answers'],['Integrity check','Finds near-identical answers'],['AI vs teacher','Agreement rate on the dashboard'],['Re-evaluate','Re-run and compare scores'],['Login and roles','Teacher and student accounts'],['PDF and CSV','Result PDFs, class CSV export'],['Command palette','Ctrl+K, shortcuts, guided tour'],['English and Urdu','RTL support, dark mode, print']].forEach((c,i)=>card(s,0.6+(i%4)*3.05,1.45+Math.floor(i/4)*1.85,2.9,1.7,c[0],c[1],['4F46E5','7C3AED','D97706','0EA5E9','059669','DC2626','312E81','6B7280','4F46E5','7C3AED','D97706','0EA5E9'][i]));
// 8b detail slides
s = slide('Accounts and roles');
card(s, 0.6, 1.5, 5.9, 2.5, 'Teacher', 'Account comes from .env. Can create questions, run batch reviews, decide queue items, re-evaluate, view the dashboard and integrity check, and export CSV.', '4F46E5');
card(s, 6.8, 1.5, 5.9, 2.5, 'Student', 'Registers a free account. Can submit answers and see only their own reviews and PDFs. Teacher pages return 403; other students\' reviews return 404.', '059669');
card(s, 0.6, 4.3, 12.1, 2.2, 'How sessions are protected', 'Passwords are hashed with PBKDF2-SHA256. Sessions are signed HttpOnly cookies that expire. Repeated failed logins are throttled. Students never receive similarity data or trace ids.', 'D97706');
s = slide('Batch review and file upload');
card(s, 0.6, 1.5, 5.9, 2.6, 'Batch review', 'Upload a CSV with student_name,answer, or drop many answer files (one per student). Reviews run one after another with a live progress bar, a summary, and a results CSV download.', '0EA5E9');
card(s, 6.8, 1.5, 5.9, 2.6, 'File upload', 'PDF, DOCX, TXT and MD are read on the server (5 MB limit). The text fills the answer box, so the teacher can check it before reviewing.', '7C3AED');
card(s, 0.6, 4.4, 12.1, 2.1, 'Limits', 'Up to 100 answers per batch, 6000 characters per answer. Scanned PDFs without a text layer cannot be read.', 'DC2626');
s = slide('Integrity check');
card(s, 0.6, 1.5, 5.9, 2.9, 'How it works', 'Each answer is turned into a set of three-word sequences. Two answers are compared with the Jaccard overlap of those sets. New submissions are compared with earlier answers to the same question and flagged at 60% or more.', '4F46E5');
card(s, 6.8, 1.5, 5.9, 2.9, 'How to read it', 'The Integrity page lists pairs above an adjustable threshold with both answers side by side. A high match is a reason to look closer, not proof of copying; short model answers can match naturally.', 'D97706');
s = slide('AI vs teacher agreement');
card(s, 0.6, 1.5, 5.9, 2.9, 'The metric', 'Of all borderline reviews the teacher decided, the agreement rate is the share approved without change. For overrides, the average change in points is also shown.', '059669');
card(s, 6.8, 1.5, 5.9, 2.9, 'Why it matters', 'It measures how much the AI can be trusted. The same decisions are sent to LangSmith as feedback, so traces can later be filtered by teacher score.', '7C3AED');
// screenshots
const shot = (title, img, cap) => { const s2 = slide(title); s2.addImage({ path:'/home/claude/proj/docs/slides_img/'+img, x:1.4, y:1.35, w:10.5, h:5.0 , sizing:{ type:'contain', w:10.5, h:5.0 } }); s2.addText(cap, { x:0.6, y:6.45, w:12.1, h:0.4, fontSize:13, color:'4B5563', align:'center', margin:0, isTextBox:true }); };
shot('Login','login.png','Login and student registration');
shot('Home page','home.png','Landing page with live statistics (teacher view)');
shot('Review result','review-result.png','Animated score ring, rubric bars, feedback, similarity warning, PDF, print, re-evaluate');
shot('Batch review','batch.png','Whole-class review from a CSV with live progress');
shot('Teacher review queue','queue.png','Borderline reviews wait for approve or override');
shot('Analytics dashboard','dashboard.png','Distribution, trend and AI vs teacher agreement, with tooltips and click-through');
shot('Integrity check','integrity.png','Side-by-side comparison of similar answers');
shot('History and filters','history.png','Search by student, filter by status, question or score');
shot('Quick search','palette.png','Ctrl+K command palette finds pages and reviews');
shot('Urdu and dark mode','urdu-dark.png','Right-to-left Urdu interface in dark theme');
shot('Student view','student-history.png','Students see only their own results');
shot('Workflow page','workflow.png','The graph and the active runtime mode shown inside the app');
// structure
s = slide('Project structure');
s.addText(['assignment-reviewer/','  run.py                 start the app','  requirements.txt  .env.example  README.md','  backend/app/','    main.py  config.py  db.py  schemas.py','    api/routes.py          REST endpoints','    graph/                 state, nodes, builder (LangGraph)','    services/              llm tracing pdf auth ...','  backend/tests/           pytest suite','  frontend/                index.html, css/, js/','  docs/                    report, slides, screenshots'].join('\n'),
 { x:0.6, y:1.4, w:7.4, h:5.2, fontFace:'Consolas', fontSize:12, color:'111827', fill:{ color:'FFFFFF' }, margin:14, valign:'top', isTextBox:true });
card(s, 8.3, 1.4, 4.4, 5.2, 'Why this layout', 'Routes, graph logic, services and storage are separate modules, so the LLM, tracing or database can change without touching the rest. Config comes from environment variables only.', '4F46E5');
// testing
s = slide('Testing and quality');
card(s, 0.6, 1.5, 5.9, 2.4, 'Automated tests', '12 pytest tests: login and roles, student isolation (403/404), review flow, score range, routing band edges, teacher override, PDF, similarity detection, re-evaluate, file extraction (txt, docx), agreement stats and CSV.', '059669');
card(s, 6.8, 1.5, 5.9, 2.4, 'Safety and robustness', 'Pydantic validation on every input, escaped output, hashed passwords and signed sessions, rate-limited login, CSV formula protection. LangSmith failures never break a review.', 'D97706');
card(s, 0.6, 4.2, 12.1, 2.3, 'Honest limits', 'Demo mode is a keyword grader and is not a replacement for the LLM. Live Groq and LangSmith runs need the student\'s own API keys; the AI score is a suggestion and the teacher decides.', 'DC2626');
// conclusion
s = slide('Conclusion and future work');
card(s, 0.6, 1.5, 5.9, 4.6, 'Summary', 'The teacher\'s CLI idea is now a complete, traced and tested web application. It keeps the original graph and routing rule, and adds rubrics, roles, batch review, integrity checks, a teacher queue, analytics and LangSmith feedback.', '4F46E5');
card(s, 6.8, 1.5, 5.9, 4.6, 'Future work', 'LangSmith datasets and evaluators, OCR for scanned answers, semantic (embedding) similarity, email notifications, deployment with HTTPS.', '7C3AED');
pres.writeFile({ fileName: '/home/claude/proj/docs/Gradewise_Presentation.pptx' }).then(async f => { await applyTheme(f, THEME); console.log('saved'); });
