// Run against a local Next build; all API calls are intercepted with synthetic fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEST_WEB_URL || 'http://127.0.0.1:4317';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Only local test servers are allowed');
const screenshotDir = process.env.QA_OUTPUT || path.resolve(__dirname, '../../qa-output');
const course = { id: 'course-test', slug: 'test-course', name: '수성못 수변 코스', description: '안전 신고 기능 검증용 가상 코스', areaName: '수성구', distanceM: 2300, estMinutes: 25, elevationGainM: 12, difficulty: '초급', themes: ['수변'], source: 'ADMIN', polyline: [[35.827,128.615],[35.829,128.616],[35.83,128.618]], checkpoints: [], pois: [] };
const fixture = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG3kAAAAASUVORK5CYII=', 'base64');
const makeReport = (id, status) => ({ id, courseId: course.id, course, status, category: 'SURFACE', severity: 'MEDIUM', description: status === 'RECEIVED' ? '' : '수변 데크 판자가 들떠 있어요.', publicNote: '', lat: 35.829, lng: 128.616, accuracyM: 8, locationSource: 'GPS', version: 1, createdAt: '2026-09-16T04:00:00Z', updatedAt: '2026-09-16T04:00:00Z', photoUrl: status === 'RECEIVED' ? null : '/api/hazards/confirmed/photo', history: [] });
(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  let checks = 0;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, geolocation: { latitude: 35.829, longitude: 128.616, accuracy: 8 }, permissions: ['geolocation'] });
    let reports = [makeReport('confirmed','CONFIRMED')], loggedIn = true, failSubmission = true, listError = false, sent = [], lastFilter = '';
    const page = await context.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    // Synthetic background in automated tests: never scrape/prefetch the public tile service.
    await context.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/png', body: fixture }));
    await context.route('**/api/**', async (route) => {
      const req = route.request(), url = new URL(req.url()), p = url.pathname;
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (p.endsWith('/photo')) return route.fulfill({ contentType: 'image/png', body: fixture });
      if (p === '/api/auth/session' || p === '/api/admin/auth/session') return json({ user: loggedIn ? { id:'admin',email:'test@example.test',role:'ADMIN',nickname:'테스트 운영자' } : null });
      if (p === '/api/admin/dashboard') return json({ counts: { courses: 1 }, recentUsers: [] });
      if (p === '/api/admin/hazards/export') return route.fulfill({ contentType:'text/csv', headers:{'Content-Disposition':'attachment; filename="hazards.csv"'}, body:'코스,위도,경도\n수성못,35.829,128.616' });
      if (p === '/api/admin/hazards') {
        lastFilter = url.search;
        const items = reports.filter((r) => (!url.searchParams.get('status') || r.status === url.searchParams.get('status')) && (!url.searchParams.get('category') || r.category === url.searchParams.get('category')));
        return json({ items,total:items.length,page:1,pageSize:25,counts: Object.fromEntries(['RECEIVED','CONFIRMED','IN_PROGRESS','RESOLVED','HIDDEN'].map((s)=>[s,reports.filter((r)=>r.status===s).length])),courses:[course] });
      }
      if (p.startsWith('/api/admin/hazards/')) {
        const report = reports.find((r)=>r.id === p.split('/').at(-1));
        if (req.method() === 'PATCH') { const payload = req.postDataJSON(); Object.assign(report,payload,{version:report.version+1}); report.history.push({id:'history-1',status:payload.status,note:payload.note,createdAt:new Date().toISOString(),admin:{nickname:'테스트 운영자'}}); return json({ok:true}); }
        return json(report);
      }
      if (p === '/api/hazards') {
        if (req.method() === 'POST') {
          sent.push(req.postDataBuffer().toString());
          if (failSubmission) { failSubmission=false; return json({error:'테스트 전송 실패. 다시 시도해 주세요.'},503); }
          const item = makeReport('new-report','RECEIVED'); reports.push(item); return json({id:item.id},201);
        }
        if (listError) return json({error:'테스트 네트워크 오류'},503);
        const items=reports.filter((r)=>['RECEIVED','CONFIRMED','IN_PROGRESS'].includes(r.status)); return json({items,total:items.length});
      }
      if (p.startsWith('/api/courses/')) return json(course);
      if (p === '/api/tour/nearby') return json({items:[],source:'TEST',fetchedMs:0});
      if (p === '/api/runs/active') return json(null);
      return json({items:[]});
    });
    await page.goto(base+'/courses/test-course');
    await page.getByRole('heading',{name:'코스 안전 제보'}).waitFor();
    await page.getByText('미해결 신고 1건',{exact:true}).waitFor(); checks++;
    await page.getByRole('button',{name:'사진으로 신고',exact:true}).click();
    await page.getByLabel('현장 사진 선택',{exact:true}).setInputFiles({ name:'damage.png',mimeType:'image/png',buffer:fixture });
    await page.getByRole('button',{name:'GPS로 현재 위치 찾기'}).click();
    await page.getByText(/GPS 위치를 찾았어요/).waitFor();
    await page.getByLabel('어떤 상황인가요? (5~500자)').fill('수변 데크 입구의 바닥 판자가 들떠 있어요.');
    await page.locator('.hazard-consent input').check();
    assert.equal(await page.getByRole('button',{name:'사진과 위치 신고하기'}).isEnabled(),true); checks++;
    await page.locator('.hazard-form').screenshot({path:path.join(screenshotDir,'hazard-report-mobile.png')});
    await page.getByRole('button',{name:'사진과 위치 신고하기'}).click();
    await page.getByRole('alert').filter({hasText:'테스트 전송 실패'}).waitFor();
    assert.ok((await page.getByLabel('어떤 상황인가요? (5~500자)').inputValue()).includes('판자')); checks++;
    await page.getByRole('button',{name:'사진과 위치 신고하기'}).click();
    await page.getByText('미해결 신고 2건',{exact:true}).waitFor();
    const token = (text) => /name="requestId"\r\n\r\n([^\r]+)/.exec(text)[1];
    assert.equal(token(sent[0]),token(sent[1])); assert.ok(sent[1].includes('name="photo"')); checks++;
    await page.locator('.course-hazards').screenshot({path:path.join(screenshotDir,'hazard-feed-mobile.png')});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)); checks++;
    await page.getByRole('button',{name:'사진으로 신고',exact:true}).click();
    await page.locator('.hazard-map .leaflet-container').click({position:{x:140,y:140}});
    await page.getByText('지도에서 선택한 위치로 신고합니다.',{exact:true}).waitFor(); checks++;
    await page.getByRole('button',{name:'닫기',exact:true}).click();
    listError=true; await page.getByRole('button',{name:'새로고침',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'현황을 확인하지 못했어요'}).waitFor(); checks++;
    listError=false; loggedIn=false;
    await page.getByRole('button',{name:'사진으로 신고',exact:true}).click();
    await page.getByRole('link',{name:'로그인 후 신고'}).waitFor(); checks++;
    loggedIn=true;
    await page.goto(base+'/run/test-course'); await page.getByRole('heading',{name:'코스 안전 제보'}).waitFor(); checks++;
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'/admin');
    await page.getByRole('button',{name:'코스 안전 신고',exact:true}).click();
    await page.getByText('검색 결과 2건 (최신 접수 순)',{exact:true}).waitFor();
    await page.getByRole('button',{name:'상세·처리'}).first().click();
    await page.getByRole('region',{name:'신고 상세 및 처리'}).waitFor();
    await page.getByLabel('처리 상태',{exact:true}).selectOption('IN_PROGRESS');
    await page.getByLabel('관리자 내부 처리 메모 (필수)').fill('현장 파손을 확인하여 보수 대기 중');
    await page.getByLabel('이용자에게 공개할 처리 안내 (선택)').fill('데크 진입 구간을 우회해 주세요.');
    await page.getByRole('button',{name:'처리 결과 저장'}).click();
    await page.locator('.hazard-history').getByText('현장 파손을 확인하여 보수 대기 중').waitFor(); checks++;
    await page.screenshot({path:path.join(screenshotDir,'hazard-admin-desktop.png'),fullPage:true});
    await page.getByLabel('상태',{exact:true}).selectOption('RECEIVED');
    await page.getByText('검색 결과 1건 (최신 접수 순)',{exact:true}).waitFor();
    assert.ok(lastFilter.includes('status=RECEIVED')); checks++;
    const downloading=page.waitForEvent('download'); await page.getByRole('button',{name:'필터 결과 CSV'}).click();
    const download=await downloading; assert.ok(download.suggestedFilename().endsWith('.csv')); checks++;
    assert.deepEqual(errors,[]); checks++;
    console.log(`PASS: ${checks} browser flow checks, screenshots in ${screenshotDir}`);
  } finally { await browser.close(); }
})().catch((e)=>{console.error(e);process.exitCode=1;});
