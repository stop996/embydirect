// ==UserScript==
// @name         emby2Potplayer
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description:zh-cn emby调用potplayer
// @author       @tanxp
// @include       *emby*
// @include       *:8*
// @run-at      document-start
// @grant       unsafeWindow
// @require      https://cdn.bootcdn.net/ajax/libs/jquery-url-parser/2.3.1/purl.js
// ==/UserScript==

//脚本会拦截所有播放请求并拉起potplayer，如需web播放请禁用

function timeFilter (seconds) {
        var ss = parseInt(seconds)/10000000
        var mm = 0// 分
        var hh = 0// 小时
        if (ss > 60) {
          mm = parseInt(ss / 60)
          ss = parseInt(ss % 60)
        }
        if (mm > 60) {
          hh = parseInt(mm / 60)
          mm = parseInt(mm % 60)
        }
        var result = ('00' + parseInt(ss)).slice(-2)
        if (mm > 0) {
          result = ('00' + parseInt(mm)).slice(-2) + ':' + result
        } else {
          result = '00:' + result
        }
        if (hh > 0) {
          result = ('00' + parseInt(hh)).slice(-2) + ':' + result
        }

        return result
};


const originFetch = fetch;
unsafeWindow.fetch = (...arg) => {

    if (arg[0].indexOf('/PlaybackInfo?UserId') > -1 && arg[0].indexOf('IsPlayback=true') > -1) {

        embyPot(arg[0])
        return ''
        }
     else{
         return originFetch(...arg);
     }

}





async function getItemInfo(itemInfoUrl){

    let response = await fetch(itemInfoUrl);
    if(response.ok)
    {
        return await response.json();
    }else{
        alert("获取视频信息失败,检查api_key是否设置正确  "+response.status+" "+response.statusText);
        throw new Error(response.statusText);
    }
}

function getSeek(itemInfoUrl){
    var seek = ""
    if (itemInfoUrl.indexOf('StartTimeTicks') > -1){
       var StartTimeTicks = purl(itemInfoUrl).param('StartTimeTicks');
        if (StartTimeTicks != '0'){
            seek = timeFilter (StartTimeTicks)
        }
    }
    console.log(seek);

    return seek;
}

function getSubUrl(api_key,itemInfo, MediaSourceIndex){
    var player_id = purl(itemInfoUrl).attr('path').split("/")[3];
    var play_host = window.location.host
    let selectSubtitles = document.querySelector("div[is='emby-scroller']:not(.hide) select.selectSubtitles");
    let subTitleUrl = '';
    if (selectSubtitles) {
        if (selectSubtitles.value > 0) {
            if (itemInfo.MediaSources[MediaSourceIndex].MediaStreams[selectSubtitles.value].IsExternal) {
                let subtitleCodec = itemInfo.MediaSources[MediaSourceIndex].MediaStreams[selectSubtitles.value].Codec;
                let MediaSourceId = itemInfo.MediaSources[MediaSourceIndex].Id;
                let domain = play_host+'/emby/videos/'+player_id;
                subTitleUrl = `${domain}/${MediaSourceId}/Subtitles/${selectSubtitles.value}/${MediaSourceIndex}/Stream.${subtitleCodec}?X-Emby-Token=${api_key}`;
                console.log(subTitleUrl);
            }
        }
    }
    return subTitleUrl;
}


async function getEmbyMediaUrl(itemInfoUrl) {
    var player_id = purl(itemInfoUrl).attr('path').split("/")[3];
    var play_host = window.location.host
    var subUrl = "";
    var api_key = purl(itemInfoUrl).param('X-Emby-Token');
    console.log(itemInfoUrl);



    let itemInfo = await getItemInfo(itemInfoUrl);

    let MediaSourceIndex = 0;
    let MediaSourceId = itemInfo.MediaSources[0].Id
    if (itemInfoUrl.indexOf('MediaSourceId') > -1){
        MediaSourceId = purl(itemInfoUrl).param('MediaSourceId');
        for(let i = 0; i< itemInfo.MediaSources.length; i++){
            if(itemInfo.MediaSources[i].Id == MediaSourceId){
                MediaSourceIndex = i;
            };
        }
    }

    let container = itemInfo['MediaSources'][MediaSourceIndex]['Container'];
    let PlaySessionId = itemInfo.PlaySessionId;
    let domain = purl(itemInfoUrl).attr('protocol')+'://'+play_host+'/emby/videos/'+player_id;

    if (itemInfoUrl.indexOf('SubtitleStreamIndex') > -1){
        var SubtitleStreamIndex = purl(itemInfoUrl).param('SubtitleStreamIndex')

        if (itemInfo.MediaSources[MediaSourceIndex].MediaStreams[parseInt(SubtitleStreamIndex)].IsExternal) {

            let subtitleCodec = itemInfo.MediaSources[MediaSourceIndex].MediaStreams[parseInt(SubtitleStreamIndex)].Codec;
            let MediaSourceId = itemInfo.MediaSources[MediaSourceIndex].Id;
            let domain = purl(itemInfoUrl).attr('protocol')+'://'+ play_host+'/emby/videos/'+player_id;
            subUrl = `${domain}/${MediaSourceId}/Subtitles/${parseInt(SubtitleStreamIndex)}/${MediaSourceIndex}/Stream.${subtitleCodec}?X-Emby-Token=${api_key}`;
        }
    }
    let streamUrl = `${domain}/stream.${container}?X-Emby-Token=${api_key}&Static=true&MediaSourceId=${MediaSourceId}&PlaySessionId=${PlaySessionId}`;
    return Array(streamUrl, subUrl);
}

async function embyPot(itemInfoUrl) {
    let mediaUrl = await getEmbyMediaUrl(itemInfoUrl);
    let poturl = `potplayer://${encodeURI(mediaUrl[0])} /sub=${encodeURI(mediaUrl[1])} /current /seek=${getSeek(itemInfoUrl)}`;
    console.log(poturl);
    window.open(poturl, "_blank");
}


