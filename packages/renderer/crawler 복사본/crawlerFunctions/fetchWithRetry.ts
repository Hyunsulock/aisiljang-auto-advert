import { AxiosInstance } from "axios";
import { BrowserWindow } from "electron/main";
import { delay } from "../crawl-listeners";

export const userAgents = [
    "Mozilla/5.0 (iPad; CPU OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5355d Safari/8536.25",
    "Mozilla/5.0 (Windows; U; MSIE 9.0; Windows NT 9.0; en-US)",
    "Mozilla/5.0 (compatible; MSIE 10.0; Macintosh; Intel Mac OS X 10_7_3; Trident/6.0)",
    "Mozilla/5.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0; GTB7.4; InfoPath.2; SV1; .NET CLR 3.3.69573; WOW64; en-US)",
    "Opera/9.80 (X11; Linux i686; U; ru) Presto/2.8.131 Version/11.11",
    "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.2 (KHTML, like Gecko) Chrome/22.0.1216.0 Safari/537.2",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_4) AppleWebKit/537.13 (KHTML, like Gecko) Chrome/24.0.1290.1 Safari/537.13",
    "Mozilla/5.0 (X11; CrOS i686 2268.111.0) AppleWebKit/536.11 (KHTML, like Gecko) Chrome/20.0.1132.57 Safari/536.11",
    "Mozilla/5.0 (Windows NT 6.2; Win64; x64; rv:16.0.1) Gecko/20121011 Firefox/16.0.1",
    "Mozilla/5.0 (X11; Ubuntu; Linux i686; rv:15.0) Gecko/20100101 Firefox/15.0.1",
];

export function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //최댓값은 제외, 최솟값은 포함
}

export async function fetchWithRetry(
    url: string,
    params: any,
    maxRetries = 10,
    api: AxiosInstance,
): Promise<any> {
    let tries = 0;
    while (tries < maxRetries) {
        const userAgent = userAgents[getRandomInt(0, userAgents.length)]
        const randomLoc1 = getRandomInt(0, 10000).toString().padStart(4, "0");
        const randomLoc2 = getRandomInt(0, 10000).toString().padStart(4, "0");
        const headers = {
            "User-Agent": userAgent,
            "Referer": `https://new.land.naver.com/complexes/364?ms=37.55${randomLoc1},127.1${randomLoc2},17&a=APT:ABYG:JGC&e=RETAIL&ad=true`,
        };
        let timeoutMs = 5000

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort(); // ⛔ 강제 종료
        }, timeoutMs);

        try {
            const res = await api.get(url, {
                params,
                headers,
                timeout: 5000,
                maxRedirects: 0,
                responseType: "text",
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (res.status === 200) {
                let dataCheck;
                try {
                    dataCheck = JSON.parse(res.data);
                    if (dataCheck.error) {
                        throw new Error(`Error: ${dataCheck.error}`);
                    }
                    console.log("dataCheck");
                    return dataCheck;
                } catch {
                    throw new Error("응답이 JSON 형식이 아님");
                }

            } else {
                throw new Error(`Error: ${res.status} ${res.statusText}`);
            }
        } catch (error) {
            console.warn(`🛑 Failed (try ${tries + 1}) → retrying...${url}`);
        }
        tries++;
        await delay(1000 + Math.random() * 5000); // 1~5초 랜덤 대기
    }

    throw new Error(`❌ fetch failed after ${maxRetries} attempts: ${url}`);
}