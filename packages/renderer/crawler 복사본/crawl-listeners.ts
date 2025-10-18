import { ipcMain } from "electron";
import { GET_INIT_DATA_CRAWL, UPLOAD_ADVERTISEMENT_CRAWL } from "./crawl-channels";
import puppeteer from 'puppeteer-core';
import { findChrome } from '@perfsee/chrome-finder'
import type { HTTPRequest } from 'puppeteer-core';
import axios from "axios";
import * as cheerio from "cheerio";
import { fetchWithRetry } from "./crawlerFunctions/fetchWithRetry";
import { Adoffer } from "@/database/entities/adOffer.entity";
import { AppDataSource } from "@/database/data-source";
import type { Page, Dialog } from 'puppeteer-core';

export function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export enum AdUploadStatus {
    START = 'start',    // 초기 상태 (작업 시작 전 또는 준비 중)
    ERASED = 'erased',  // 삭제 완료 상태
    SAVED = 'saved',    // 로컬 저장 완료 상태
    SAVED_SECOND = 'saved_second', // 두 번째 저장 완료 상태
    UPLOADED = 'uploaded', // 전송 완료 상태
}

function assignRankingsAccurate(
    representativeMap: Record<string, any[]>
): Record<string, any[]> {
    for (const [repNo, articles] of Object.entries(representativeMap)) {
        let ranking = 1;
        let sharedRank = 1;
        let currentGroupDate = "";
        let currentGroup: any[] = [];
        const allGroups: any[][] = [];

        for (const article of articles) {
            article.ranking = ranking++;

            const date = article.articleConfirmYmd;

            if (currentGroup.length === 0 || date === currentGroupDate) {
                currentGroup.push(article);
                currentGroupDate = date;
            } else {
                allGroups.push([...currentGroup]);
                currentGroup = [article];
                currentGroupDate = date;
            }
        }

        // 마지막 그룹 추가
        if (currentGroup.length > 0) {
            allGroups.push(currentGroup);
        }

        // 이제 sharedRank, sharedCount, isShared 추가
        for (const group of allGroups) {
            const isShared = group.length > 1;
            const sharedCount = group.length;
            for (const article of group) {
                article.sharedRank = sharedRank;
                article.sharedCount = sharedCount;
                article.isShared = isShared;
            }
            sharedRank += sharedCount; // 다음 그룹의 sharedRank는 현재 그룹의 sharedCount만큼 증가
        }
    }

    return representativeMap;
}


// import axios from 'axios';
export function addCrawlerEventListeners() {

    ipcMain.handle(GET_INIT_DATA_CRAWL, async () => {
        let sessionCookies = [];

        console.log('get init data crawl')
        let chromeInfo = await findChrome({
            // download: {
            //     puppeteer,
            //     path: join('.', 'chrome'),
            //     revision: PUPPETEER_REVISIONS.chrome
            // }
        })

        const browser = await puppeteer.launch({
            headless: false,
            executablePath: chromeInfo.executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
            ],

        });

        const naverPage = await browser.newPage();

        // 🤖 봇 탐지 우회
        await naverPage.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );

        await naverPage.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        let bearerToken;


        naverPage.on('request', (request) => {
            const url = request.url();
            if (url.includes(`/api/complexes/overview/364`)) {
                const auth = request.headers()['authorization'];
                if (auth?.startsWith('Bearer ')) {
                    bearerToken = auth.replace('Bearer ', ''); // 👈 접두어 제거!
                }
            }
        });

        await naverPage.goto(`https://new.land.naver.com/complexes/364?17&a=APT:ABYG:JGC:PRE&e=RETAIL&ad=true`, {
            waitUntil: 'networkidle2',
        });

        await delay(3000);
        //await browser.close()

        if (!bearerToken) {
            throw new Error('token not found in the response.');
        }

        const page = await browser.newPage();
        await page.goto('https://www.aipartner.com/integrated/login?serviceCode=1000', { waitUntil: 'networkidle2' });


        while (true) {

            // ✅ 2. 로그인 될 때까지 무한 대기
            console.log('⏳ 사용자 로그인 대기 중...');
            await page.waitForFunction(
                () => location.href === 'https://www.aipartner.com/home',
                { timeout: 0 }
            );
            console.log('🟢 로그인 성공 감지됨');

            await page.goto('https://www.aipartner.com/offerings/ad_list', {
                waitUntil: 'networkidle2',
            });

            const currentUrl = page.url();
            console.log('🔍 광고 리스트 접근 시도. 현재 URL:', currentUrl);

            if (!currentUrl.includes('/login')) {
                console.log('✅ 광고 리스트 접근 성공. 루프 종료!');
                const context = page.browserContext();
                sessionCookies = await context.cookies();
                break;
            }

            console.log('🔴 접근 실패: 다시 로그인 페이지로 리디렉션됨. 로그인 안 된 상태');

        }

        await page.waitForSelector(
            '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusIng.GTM_offerings_ad_list_ad_ing',
            { timeout: 10000 }
        );
        let tokenData;


        function handleRequest(req: HTTPRequest) {
            if (req.method() === 'POST' && req.url().includes('/offerings/ad_list')) {
                console.log('✅ 요청 감지됨');
                //console.log(req.postData());
                const postData = req.postData(); //
                const parsed = new URLSearchParams(postData);
                tokenData = parsed.get('_token') ?? '';
                console.log('✅ _token:', tokenData);
            }
        }

        // ✅ 요청 감지 핸들러 설정
        page.on('request', handleRequest);

        await page.click(
            '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusIng.GTM_offerings_ad_list_ad_ing'
        );

        page.off('request', handleRequest);

        const cookieHeader = sessionCookies.map(c => `${c.name}=${c.value}`).join('; ');

        // 요청 body
        // const body = new URLSearchParams({
        //     _token: tokenData!,
        //     page: '1',
        //     adName: 'ad',
        // }).toString();

        // const response = await axios.post('https://www.aipartner.com/offerings/ad_list', body, {
        //     headers: {
        //         'Content-Type': 'application/x-www-form-urlencoded',
        //         'Cookie': cookieHeader,
        //         'Referer': 'https://www.aipartner.com/offerings/ad_list',
        //         'Origin': 'https://www.aipartner.com',
        //         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        //     },
        //     responseType: 'text', // HTML로 응답 받음
        // });

        // const $ = cheerio.load(response.data);
        // const rows = $("table.tableAdSale tbody tr");

        // const result: any[] = [];

        // rows.each((_, el) => {
        //     const row = $(el);
        //     const offer = {
        //         numberA: row.find(".numberA").text().trim(), // 내부 매물번호
        //         numberN: row.find(".numberN").text().trim(), // 네이버 매물번호
        //         type: row.find("td").eq(2).text().trim(), // 매물종류 (아파트 등)
        //         dong: row.find(".dongInfo").text().trim(), // 동 (지역)
        //         address: row.find(".fullName .pre-wrap").text().trim(), // 단지명 + 호수
        //         areaPublic: row.find('.squareMeter[data-gu="[공]"]').attr("data-value"), // 공용면적
        //         areaPrivate: row.find('.squareMeter[data-gu="[전]"]').attr("data-value"), // 전용면적
        //         dealType: row.find(".dealType").text().trim(), // 매매, 전세 등
        //         price: row.find(".price").text().trim(), // 가격 (만원)
        //         adStatus: row.find(".statusAd").text().trim(), // 광고중, 거래완료 등
        //         dateRange: row.find("td.date").text().trim(), // 노출 기간 (시작일 ~ 종료일)
        //     };
        //     result.push(offer);
        // });

        // console.log(result);
        const result: any[] = [];

        let pageNum = 1;

        const adOfferRepo = AppDataSource.getRepository(Adoffer);

        while (true) {
            const body = new URLSearchParams({
                _token: tokenData!,
                page: pageNum.toString(),
                adName: "ad",
            }).toString();

            const response = await axios.post("https://www.aipartner.com/offerings/ad_list", body, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Cookie: cookieHeader,
                    Referer: "https://www.aipartner.com/offerings/ad_list",
                    Origin: "https://www.aipartner.com",
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
                },
                responseType: "text",
            });

            const $ = cheerio.load(response.data);
            const rows = $("table.tableAdSale tbody tr");

            const firstRowText = rows.first().text().trim();
            if (rows.length === 1 && firstRowText.includes("매물이 존재하지 않습니다")) {
                console.log(`📄 페이지 ${pageNum}에 매물이 없습니다. 종료.`);
                break;
            }

            console.log(`📄 페이지 ${pageNum} 에서 ${rows.length}건 수집`);

            rows.each((_, el) => {
                const row = $(el);
                const adChannelCell = row.find("td").eq(6); // 7번째 <td> (노출채널/검증방식)
                const adChannel = adChannelCell.find(".channel").text().trim() || null;

                const adMethod = adChannelCell
                    .clone() // 복제해서
                    .children() // 자식 요소 (span 등) 제거
                    .remove()
                    .end()
                    .text()
                    .replace('/', '')
                    .trim() || null;
                const offer = {
                    numberA: row.find(".numberA").text().trim(),
                    numberN: row.find(".numberN").text().trim(),
                    type: row.find("td").eq(2).text().trim(),
                    dong: row.find(".dongInfo").text().trim(),
                    address: row.find(".fullName .pre-wrap").text().trim(),
                    areaPublic: row.find('.squareMeter[data-gu="[공]"]').attr("data-value"),
                    areaPrivate: row.find('.squareMeter[data-gu="[전]"]').attr("data-value"),
                    dealType: row.find(".dealType").text().trim(),
                    price: row.find(".price").text().trim(),
                    adChannel: adChannel,
                    adMethod: adMethod,
                    adStatus: row.find(".statusAd").text().trim(),
                    dateRange: row.find("td.date").text().trim(),
                };
                result.push(offer);
            });

            pageNum++;
        }


        console.log(result);


        const api = axios.create({
            baseURL: 'https://new.land.naver.com/api/',
            headers: {
                authorization:
                    `Bearer ${bearerToken}`,
                Host: "new.land.naver.com",
                "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
            },
            //httpsAgent: proxyAgent,
        });

        let naverData: Record<string, any> = {};
        for (const item of result) {
            let neverNumber = item.numberN;
            let data = await fetchWithRetry(
                "articles",
                { representativeArticleNo: neverNumber },
                10,
                api,
            )
            naverData[neverNumber] = data;

            await delay(1000 + Math.random() * 2000);
        }



        const naverRanked = assignRankingsAccurate(naverData);

        let naverRankedRepresentive: Record<string, any> = {};
        for (const [repNo, articles] of Object.entries(naverRanked)) {
            console.log("repNo", repNo)
            console.log("articles", articles[0])
            let matched = articles.find((article: any) => article.articleNo == repNo);
            if (matched) {
                matched.total = articles.length;
            }
            if (matched) {
                naverRankedRepresentive[repNo] = matched;
            }
            console.log("matched", matched)
        }


        for (const item of result) {
            const offer = adOfferRepo.create({
                numberA: item.numberA,
                numberN: item.numberN,
                type: item.type,
                dong: item.dong,
                address: item.address,
                areaPublic: item.areaPublic ? parseFloat(item.areaPublic) : null,
                areaPrivate: item.areaPrivate ? parseFloat(item.areaPrivate) : null,
                dealType: item.dealType,
                price: item.price,
                adChannel: item.adChannel,
                adMethod: item.adMethod,
                adStatus: item.adStatus,
                dateRange: item.dateRange,
                ranking: naverRankedRepresentive[item.numberN]?.ranking ?? null,
                sharedRank: naverRankedRepresentive[item.numberN]?.sharedRank ?? null,
                isShared: naverRankedRepresentive[item.numberN]?.isShared ?? null,
                sharedCount: naverRankedRepresentive[item.numberN]?.sharedCount ?? null,
                total: naverRankedRepresentive[item.numberN]?.total ?? null,
            });

            await adOfferRepo.save(offer);
        }
        //console.log("✅ 전체 매물 수집 완료:", result.length);
        //let data = await adOfferRepo.find()



















    });


    ipcMain.handle(UPLOAD_ADVERTISEMENT_CRAWL, async (event, data: any) => {
        const adOfferRepo = AppDataSource.getRepository(Adoffer);
        for (const item of data) {
            const offerExists = await adOfferRepo.findOne({
                where: { numberN: item.numberN }
            });
            if (!offerExists) {
                console.log(`❌ ${item.numberN} 매물이 존재하지 않습니다.`);
                continue;
            }

            await adOfferRepo.update(offerExists.id, {
                adUpload: AdUploadStatus.START,
            });

        }

        console.log('get init data crawl', data)
        let chromeInfo = await findChrome({
            // download: {
            //     puppeteer,
            //     path: join('.', 'chrome'),
            //     revision: PUPPETEER_REVISIONS.chrome
            // }
        })

        const browser = await puppeteer.launch({
            headless: false,
            executablePath: chromeInfo.executablePath,
            defaultViewport: {
                width: 1280,
                height: 1000,
            },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
            ],

        });

        const page = await browser.newPage();
        await page.goto('https://www.aipartner.com/integrated/login?serviceCode=1000', { waitUntil: 'networkidle2' });


        while (true) {

            // ✅ 2. 로그인 될 때까지 무한 대기
            console.log('⏳ 사용자 로그인 대기 중...');
            await page.waitForFunction(
                () => location.href === 'https://www.aipartner.com/home',
                { timeout: 0 }
            );
            console.log('🟢 로그인 성공 감지됨');

            await page.goto('https://www.aipartner.com/offerings/ad_list', {
                waitUntil: 'networkidle2',
            });

            const currentUrl = page.url();
            console.log('🔍 광고 리스트 접근 시도. 현재 URL:', currentUrl);

            if (!currentUrl.includes('/login')) {
                // console.log('✅ 광고 리스트 접근 성공. 루프 종료!');
                // const context = page.browserContext();
                // sessionCookies = await context.cookies();
                break;
            }

            console.log('🔴 접근 실패: 다시 로그인 페이지로 리디렉션됨. 로그인 안 된 상태');

        }





        while (true) {


            const uploadOffers = await adOfferRepo.find({
                where: { adUpload: AdUploadStatus.START },
            });

            console.log("업로드할 매물 수", uploadOffers);


            let targetNumbers = uploadOffers.map((item: any) => item.numberN);

            if (targetNumbers.length === 0) {
                console.log("업로드할 매물이 없습니다.");
                break;
            }

            console.log("target", targetNumbers);



            await page.waitForSelector(
                '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusIng.GTM_offerings_ad_list_ad_ing',
                { timeout: 10000 }
            );

            await page.click(
                '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusIng.GTM_offerings_ad_list_ad_ing'
            );

            let isFound = false;


            while (true) {

                await page.waitForSelector('table > tbody > tr', { timeout: 5000 });
                await page.waitForSelector('div.pagination a.btnArrow.next');
                await page.waitForSelector('div.pagination a.btnPage.on');

                const rows = await page.$$(
                    '#wrap > div > div > div > div.sectionWrap > div.singleSection.listSection > div.listWrap > table > tbody > tr'
                );


                for (const row of rows) {
                    const numberText = await row.$eval('td .numberN', el =>
                        el.textContent?.replace(/\D/g, '').trim()
                    ).catch(() => null);

                    if (!numberText || !targetNumbers.includes(numberText)) continue;

                    console.log(`✅ 매칭됨: ${numberText}`);

                    const endButton = await row.$('td #naverEnd');
                    if (endButton) {
                        const dialogEndNaver = new Promise((resolve, reject) => {
                            const handler = async (dialog: any) => {
                                let message = dialog.message();
                                if (message === "네이버에서 노출종료 할까요?") {
                                    console.log("☑️ '확인' 선택함 (confirm)");
                                    await dialog.accept();
                                    page.off('dialog', handler);
                                    resolve(true);
                                    return;
                                } else {
                                    console.log("❌ '취소' 선택함 (dismiss)");
                                    await dialog.dismiss();
                                    page.off('dialog', handler);
                                    resolve(false);
                                    return;
                                }
                            };
                            page.on("dialog", handler);
                        });
                        await endButton.click();
                        const isChecked = await dialogEndNaver
                        const dialogNaverEnded = new Promise((resolve, reject) => {
                            const handler = async (dialog: any) => {
                                let message = dialog.message();
                                if (message === "네이버에서 노출종료 했어요.") {
                                    console.log("☑️ '확인' 선택함 (confirm)");
                                    await dialog.accept();
                                    page.off('dialog', handler);
                                    resolve(true);
                                    return;
                                } else {
                                    await dialog.dismiss();
                                    page.off('dialog', handler);
                                    resolve(false);
                                    return;
                                }
                            };
                            page.on("dialog", handler);
                        });

                        console.log("🚫 confirm dialog 발생됨", isChecked);

                        if (isChecked) {
                            console.log("🟢 confirmed");
                        } else {
                            console.log("🔴 rejected");
                            throw new Error("Dialog was rejected");
                        }





                        const isNaverEnded = await dialogNaverEnded

                        console.log("🚫 confirm dialog 발생됨", isNaverEnded)

                        if (!isNaverEnded) {
                            console.log("🔴 rejected");
                            throw new Error("Dialog was rejected");
                        }

                        console.log("🟢 confirmed");
                        const offerExists = await adOfferRepo.findOne({
                            where: { numberN: numberText }
                        });
                        if (!offerExists) {
                            console.log(`❌ ${numberText} 매물이 존재하지 않습니다.`);
                            throw new Error(`Offer ${numberText} not found`);
                        }

                        await adOfferRepo.update(offerExists.id, {
                            adUpload: AdUploadStatus.ERASED,
                        });
                        isFound = true;
                        break;
                    }


                }

                if (isFound) break;



                await page.waitForSelector('div.pagination a.btnArrow.next');
                await page.waitForSelector('div.pagination a.btnPage.on');
                await delay(2000) // 1초 대기


                const nextPageBtn = await page.$('div.pagination a.btnArrow.next');
                const currentPageBtn = await page.$('div.pagination a.btnPage.on');



                console.log("nextPageBtn");



                if (nextPageBtn && currentPageBtn) {
                    //nextValue = await page.evaluate(el => el.getAttribute('data-value'), nextPageBtn);
                    const nextValue = await page.evaluate(() => {
                        const el = document.querySelector('div.pagination a.btnArrow.next');
                        return el?.getAttribute('data-value');
                    });
                    const currentValue = await page.evaluate(() => {
                        const el = document.querySelector('div.pagination a.btnPage.on');
                        return el?.getAttribute('data-value');
                    });
                    //currentValue = await page.evaluate(el => el.getAttribute('data-value'), currentPageBtn);

                    if (nextValue === currentValue) {
                        console.log("✅ 마지막 페이지 도달");
                        break;
                    }

                    console.log('nextpage button before click')

                    const nextPageBtnNew = await page.$('div.pagination a.btnArrow.next');
                    if (nextPageBtnNew) {
                        await nextPageBtnNew.evaluate(el => el.scrollIntoView({ behavior: 'auto', block: 'center' }));
                        await nextPageBtnNew.click();

                    } else {
                        console.log("✅ 다음 페이지 버튼이 없습니다.");
                        throw new Error("Next page button not found");
                    }
                }


            }

        }






        const erasedOffers = await adOfferRepo.find({
            where: { adUpload: AdUploadStatus.ERASED },
        });

        const erasedCount = erasedOffers.length;

        let targetNumbers = erasedOffers.map((item: any) => item.numberN);

        for (const offer of erasedOffers) {

            await page.waitForSelector(
                '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusAdEnd.GTM_offerings_ad_list_end_ad',
                { timeout: 10000 }
            );

            await delay(2000); // 2초 대기


            await page.click(
                '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusAdEnd.GTM_offerings_ad_list_end_ad'
            );


            while (true) {

                await page.waitForSelector('table > tbody > tr', { timeout: 5000 });


                const rows = await page.$$(
                    '#wrap > div > div > div > div.sectionWrap > div.singleSection.listSection > div.listWrap > table > tbody > tr'
                );

                let isFound = false;
                let foundNumber;

                if (targetNumbers.length === 0) {
                    console.log("업로드할 매물이 없습니다.");
                    break;
                }




                for (const row of rows) {
                    const numberN = await row.$eval('.numberN', el => el.textContent?.replace(/\D/g, '').trim()).catch(() => null);

                    if (!numberN) continue;

                    if (targetNumbers.includes(numberN)) {
                        console.log(`✅ matched for upload: ${numberN}`);

                        const reAdBtn = await row.$('a.management.GTM_offerings_ad_list_listing_adre');
                        if (reAdBtn) {
                            await Promise.all([
                                page.waitForNavigation({ waitUntil: 'networkidle2' }),
                                reAdBtn.click(),
                            ]);
                            targetNumbers = targetNumbers.filter((num: any) => num !== numberN); // 클릭한 numberN 제거
                            const offerExists = await adOfferRepo.findOne({
                                where: { numberN: numberN }
                            });
                            if (!offerExists) {
                                console.log(`❌ ${numberN} 매물이 존재하지 않습니다.`);
                                throw new Error(`Offer ${numberN} not found`);
                            }
                            await adOfferRepo.update(offerExists.id, {
                                adUpload: AdUploadStatus.SAVED,
                            });
                            foundNumber = numberN;

                            console.log(`🟢 read clicked(numberN: ${numberN})`);
                        } else {
                            console.log(`⚠️ no read (numberN: ${numberN})`);
                        }
                        isFound = true;

                        break; // 매칭되면 루프 중단
                    }

                }

                if (!isFound) {
                    const nextPageBtn = await page.$('div.pagination a.btnArrow.next');
                    const currentPageBtn = await page.$('div.pagination a.btnPage.on');



                    console.log("nextPageBtn");



                    if (nextPageBtn && currentPageBtn) {
                        //nextValue = await page.evaluate(el => el.getAttribute('data-value'), nextPageBtn);
                        const nextValue = await page.evaluate(() => {
                            const el = document.querySelector('div.pagination a.btnArrow.next');
                            return el?.getAttribute('data-value');
                        });
                        const currentValue = await page.evaluate(() => {
                            const el = document.querySelector('div.pagination a.btnPage.on');
                            return el?.getAttribute('data-value');
                        });
                        //currentValue = await page.evaluate(el => el.getAttribute('data-value'), currentPageBtn);

                        if (nextValue === currentValue) {
                            console.log("✅ 마지막 페이지 도달");
                            break;
                        }
                        if (erasedCount < 30) {
                            console.log("✅ 없는듯듯");
                            break;
                        }

                        if (currentValue === "10") {
                            console.log("✅ 없는듯듯");
                            break;
                        }


                        await nextPageBtn.evaluate(el => el.scrollIntoView({ behavior: 'auto', block: 'center' }));
                        await nextPageBtn.click();
                    } else {
                        throw new Error("Next page button not found");
                    }
                    continue; // 다음 페이지로 이동
                }

                const currentUrl = page.url();
                if (currentUrl.startsWith("https://www.aipartner.com/offerings/ad_regist")) {
                    console.log("✅ ad_regist 페이지로 이동 완료");
                    await page.waitForSelector('#offeringsAdSave');
                    const saveBtn = await page.$('#offeringsAdSave');
                    if (saveBtn) {
                        await saveBtn.evaluate(el => el.scrollIntoView({ behavior: 'auto', block: 'center' }));
                        const dialogSavedProperty = new Promise((resolve, reject) => {
                            const handler = async (dialog: any) => {
                                let message = dialog.message();
                                if (message === "매물을 저장 하였습니다.") {
                                    console.log("☑️ '확인' 선택함 (confirm)");
                                    await Promise.all([
                                        page.waitForNavigation({ waitUntil: 'networkidle2' }),
                                        dialog.accept(), // 클릭 등 네비게이션 유도
                                    ]);
                                    page.off('dialog', handler);
                                    resolve(true);
                                    return;
                                } else {
                                    await dialog.dismiss();
                                    page.off('dialog', handler);
                                    resolve(false);
                                    return;
                                }
                            };
                            page.on("dialog", handler);
                        });
                        await saveBtn.click(); // v21 이상이면 정상 작동


                        const isSavedProperty = await dialogSavedProperty

                        console.log("🚫 confirm dialog 발생됨", isSavedProperty)

                        if (!isSavedProperty) {
                            console.log("🔴 rejected");
                            throw new Error("Dialog was rejected");
                        }

                    }
                    console.log("🟢 offeringsAdSave 버튼 클릭 완료");
                } else {
                    throw new Error("❌ ad_regist 페이지로 이동 실패");
                }


                await page.waitForFunction(() =>
                    location.href.includes('/offerings/verification/'),
                    {
                        timeout: 60000,   // 최대 10초까지만 기다림
                        polling: 500      // 0.5초마다 조건 확인
                    }
                );
                //await page.waitForNavigation({ waitUntil: 'networkidle2' }),


                console.log("🟢 verification 페이지로 이동 완료")
                delay(2000); // 2초 대기

                await page.waitForSelector('label[for="consentMobile2"]');
                const consentButtonlabel = await page.$('label[for="consentMobile2"]');
                if (consentButtonlabel) {
                    await consentButtonlabel.evaluate(el =>
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    );
                    await consentButtonlabel.click();
                    console.log('✅ consentMobile2 클릭 완료');
                } else {
                    console.log('❌ consentMobile2 버튼을 찾을 수 없습니다.');
                }

                await page.waitForSelector('#payMsg');

                const payMsg = await page.$('#payMsg');
                if (payMsg) {
                    await payMsg.evaluate(el =>
                        el.scrollIntoView({ behavior: 'smooth', block: 'end' })
                    );
                } else {
                    console.log('❌ payMsg 요소를 찾을 수 없습니다.');
                }

                await delay(2000); // 2초 대기



                await page.waitForSelector('#naverSendSave');

                const naverSaveBtn = await page.$('#naverSendSave');
                if (naverSaveBtn) {
                    await naverSaveBtn.evaluate(el =>
                        el.scrollIntoView({ behavior: 'smooth', block: 'end' })
                    );
                    const dialogSavedRocket = new Promise((resolve, reject) => {
                        const handler = async (dialog: any) => {
                            let message = dialog.message();
                            if (message === "로켓전송이 완료되었습니다.") {
                                console.log("☑️ '확인' 선택함 (로켓전송)");
                                await Promise.all([
                                    page.waitForNavigation({ waitUntil: 'networkidle2' }),
                                    dialog.accept(), // 클릭 등 네비게이션 유도
                                ]);
                                //await dialog.accept();
                                resolve(true);
                                return;
                            } else if (message === "네이버에 매물을 전송했어요.") {
                                console.log("☑️ '확인' 선택함 (네이버전송)");
                                await Promise.all([
                                    page.waitForNavigation({ waitUntil: 'networkidle2' }),
                                    dialog.accept(), // 클릭 등 네비게이션 유도
                                ]);
                                //await dialog.accept();
                                resolve(true);
                                return;
                            } else {
                                console.log(message)
                                //await dialog.dismiss();
                                page.off('dialog', handler);
                                resolve(false);
                                return;
                            }
                        };
                        page.on("dialog", handler);
                    });
                    await naverSaveBtn.click();
                    const isRocketChecked = await dialogSavedRocket
                    if (isRocketChecked) {
                        const offerExists = await adOfferRepo.findOne({
                            where: { numberN: foundNumber }
                        });
                        if (!offerExists) {
                            console.log(`❌ ${foundNumber} 매물이 존재하지 않습니다.`);
                            continue;
                        }

                        await adOfferRepo.update(offerExists.id, {
                            adUpload: AdUploadStatus.UPLOADED,
                        });
                        console.log("🟢 confirmed");
                    } else {
                        console.log("🔴 rejected");
                        throw new Error("Dialog was rejected");
                    }

                    console.log('✅ naverSendSave 버튼 클릭 완료');
                } else {
                    console.log('❌ naverSendSave 버튼 없음');
                }

                await page.waitForFunction(() =>
                    location.href.includes('/offerings/verify/'),
                    {
                        timeout: 60000,   // 최대 10초까지만 기다림
                        polling: 500      // 0.5초마다 조건 확인
                    }
                );

                //await page.waitForNavigation({ waitUntil: 'networkidle2' }),

                delay(2000); // 2초 대기




                console.log("🟢 verify 페이지로 이동 완료")

                await page.waitForSelector('#btnCancel');

                const cancelBtn = await page.$('#btnCancel');
                if (cancelBtn) {
                    await cancelBtn.evaluate(el =>
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    );
                    delay(2000); // 2초 대기
                    let cancelBtnNew = await page.$('#btnCancel');
                    if (cancelBtnNew) {


                        await Promise.all([
                            page.waitForNavigation({ waitUntil: 'networkidle2' }),
                            cancelBtn.click(), // 클릭 등 네비게이션 유도
                        ]);
                    } else {
                        throw new Error("❌ btnCancel 버튼 없음");
                    }

                    await page.waitForFunction(() =>
                        location.href.includes('/offerings/ad_list'),
                        {
                            timeout: 60000,   // 최대 10초까지만 기다림
                            polling: 500      // 0.5초마다 조건 확인
                        }
                    );

                    //await page.waitForNavigation({ waitUntil: 'networkidle2' })

                    delay(2000)
                    const currentUrl = page.url();
                    if (currentUrl.startsWith("https://www.aipartner.com/offerings/ad_list")) {
                        console.log("✅ ad_list 페이지로 이동 완료");
                    } else {
                        throw new Error("❌ ad_list 페이지로 이동 실패");
                    }
                    console.log('✅ btnCancel 버튼 클릭 완료');
                    break;


                } else {
                    console.log('❌ btnCancel 버튼 없음');
                    throw new Error("❌ btnCancel 버튼 없음");
                }

            }






        }






















    });




}
