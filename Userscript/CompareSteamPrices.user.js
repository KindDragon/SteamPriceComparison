// ==UserScript==
// @name        Steam Price Comparison - Unpowered edition
// @version     2.4.4
// @namespace   http://steamunpowered.eu/comparison-script/
// @description Displays prices from all regions in the Steam store and convert them to your local currency
// @copyright   2011+, KindDragon; 2010+, Zuko; Original author: Tor (http://code.google.com/p/steam-prices/)
// @homepage    http://userscripts.org/scripts/show/149928
// @update	2.4.4 Russian price detection fixed. Settings now stored in GM settings.
// @update	2.4.3 Price "N/A" fixed. Opera support improved.
// @update	2.4.1 Page price detection fixed.
// @update	2.4.0 Support for CIS countries added. Code highly refactored. Auto-detecting used price in page. 
// @update	2.3.3 Brazilian prices support added.
// @update	2.3.2 Sale page support added.
// @update	2.3.1 Page formating fixed in some cases.
// @update	2.3.0 Script fixed after site changes.
// @license     MIT License; http://www.opensource.org/licenses/mit-license.php
// @include     http://store.steampowered.com/app/*
// @include     https://store.steampowered.com/app/*
// @include     http://store.steampowered.com/sub/*
// @include     https://store.steampowered.com/sub/*
// @include     http://store.steampowered.com/sale/*
// @include     https://store.steampowered.com/sale/*
// @match       http://store.steampowered.com/app/*
// @match       https://store.steampowered.com/app/*
// @match       http://store.steampowered.com/sub/*
// @match       https://store.steampowered.com/sub/*
// @match       http://store.steampowered.com/sale/*
// @match       https://store.steampowered.com/sale/*
// @grant       none
// @require     https://userscripts.org/scripts/source/145813.user.js
// ==/UserScript==

// To install save script to disk under name CompareSteamPrices.user.js and then open this file in Firefox

// Russian, Brazilian and CIS prices added by KindDragon (https://github.com/KindDragon)

/*
 * Configuration
 * If you want to modify the parameters of the script,
 * please make your changes here.
 */

 if (!this.GM_getValue || (this.GM_getValue.toString && this.GM_getValue.toString().indexOf("not supported")>-1)) {
    this.GM_getValue=function (key,def) {
        return localStorage[key] || def;
    };
    this.GM_setValue=function (key,value) {
        return localStorage[key]=value;
    };
    this.GM_deleteValue=function (key) {
        return delete localStorage[key];
    };
}

// first time init, you can changes this values in about:config page
if (typeof GM_getValue("showYourLocalCurrency") === "undefined")
{
	GM_setValue("showYourLocalCurrency", true);
	GM_setValue("showUSPrice", true);
	GM_setValue("showUKPrice", true);
	GM_setValue("showTieredEuPrices", true);
	GM_setValue("showAUPrice", true);
	GM_setValue("showRUPrice", true);
	GM_setValue("showCISPrice", true);
	GM_setValue("showBRPrice", true);
	GM_setValue("usVat", 0);
}

//If set to true, prices converted to your local currency will be displayed
var showYourLocalCurrency = GM_getValue("showYourLocalCurrency", true);
var yourLocalCurrency = GM_getValue("yourLocalCurrency");
//yourLocalCurrency = "UAH";

//If set to true, US prices will be displayed
var showUSPrice = GM_getValue("showUSPrice", true);

//If set to true, UK prices will be displayed
var showUKPrice = GM_getValue("showUKPrice", true);

/*
 * If set to true, the script will display prices from both of Valve's
 * price regions, or "tiers". If false, the script will show only your
 * country's prices. More details on the tiers can be found here:
 * http://steamunpowered.eu/page.php?id=139
 * For games where prices are equal in all regions, the script will display
 * only one value no matter what this setting is configured to.
 */
var showTieredEuPrices = GM_getValue("showTieredEuPrices", true);

//If set to true, Australian prices will be display
var showAUPrice = GM_getValue("showAUPrice", true);

//If set to true, Russian prices will be displayed
var showRUPrice = GM_getValue("showRUPrice", true);

//If set to true, CIS prices will be displayed
var showCISPrice = GM_getValue("showCISPrice", true);

//If set to true, Brazilian prices will be displayed
var showBRPrice = GM_getValue("showBRPrice", true);

//These parameters contain one country code from each of the European tiers.
var tier1cc = "se";
var tier2cc = "pl";
//These parameters contain one country code from CIS countries.
var CIScc = "ua";
//Change this parameter to add VAT to the US price displayed.
//E.g. if set to 19, the script will increase US prices by 19%.
var usVat = GM_getValue("usVat", 0);

/*
 * End of configuration area
 * Don't make changes below this line unless you know what you're doing.
 */

var urlGamePattern = new RegExp(/^https?:\/\/store.steampowered.com\/(?:app|sub)\/\d+\/?(?:\?(?:(?!cc)\w+=[^&]*&?)*)?$/i);
var urlSalePattern = new RegExp(/^https?:\/\/store.steampowered.com\/sale\/\w+\/?(?:\?(?:(?!cc)\w+=[^&]*&?)*)?$/i);
//var urlGenrePattern = new RegExp(/^https?:\/\/store.steampowered.com\/genre\/.+\/?/i);

var pricenodes = new Array();
var pricenodes_conly = new Array();
var originalprices = new Array();
var originalprices_conly = new Array();
var someNode;
var exchangerateScripts = {};
//var tier1text = "Albania, Andorra, Austria, Belgium, Denmark, Finland, " +
//                "France, Germany, Ireland, Liechtenstein, Luxembourg, Macedonia, " +
//                "Netherlands, Sweden, Switzerland";
//var tier2text = "Bosnia and Herzegovina, Bulgaria, Croatia, Cyprus, " +
//                "Czech Republic, Estonia, Greece, Hungary, Italy, Latvia, Lithuania, " +
//                "Malta, Monaco, Montenegro, Norway, Poland, Portugal, Romania, San Marino, " +
//                "Serbia, Slovakia, Slovenia, Spain, Vatican City";
//var cistext   = "Armenia, Azerbaijan, Belarus, Georgia, Kazakhstan, Kyrgyzstan, " +
//                "Moldova, Tajikistan, Turkmenistan, Uzbekistan, Ukraine";

function AddExchangeRateScript(fromCurrency, toCurrency, skipEqual) {
    if (skipEqual && fromCurrency == toCurrency)
        return;
    var key = fromCurrency + toCurrency;
    if (!(key in exchangerateScripts))
    {
        var script = document.createElement("script");
        script.setAttribute("type", "text/javascript");
        script.setAttribute("src",
            "http://javascriptexchangerate.appspot.com/?from=" + fromCurrency + "&to=" + toCurrency);
        document.body.insertBefore(script, someNode);
        exchangerateScripts[key] = script;
    }
}

function SteamPage(countryName, countryCode, currencyCode, show, valuepattern, vat, globalCountryName, dependedPage) {
    this.countryName = countryName;
    this.countryCode = countryCode;
    this.currencyCode = currencyCode;
    this.show = show;
    this.valuepattern = valuepattern;
    this.vat = typeof(vat)==='undefined' ? 0 : vat;
    this.globalCountryName = globalCountryName;
    this.dependedPage = dependedPage;
    this.http;

    this.getCountryPageUrl = function() {
        var pos=document.documentURI.indexOf('?');
        if (pos < 0)
            return document.documentURI+"?cc="+this.countryCode;
        else
            return document.documentURI+"&cc="+this.countryCode;
    };

    this.findPrice = function() {
        if (!this.show)
            return;
        //Search for the price information in the downloaded HTML documents
        try {
            this.priceHtml = this.pricepattern.exec(this.http.responseText)[1];
            this.price = parseFloat(this.valuepattern.exec(this.priceHtml)[1].replace(",", ".").replace("--", "00"));
            if (this.vat > 0) {
                this.price = this.price * (1 + (this.vat / 100));
                this.priceHtml = "$" + this.price.toFixed(2);
            }
        }
        catch (err) {
            //Prevent search from looping around and starting at the beginning
            if (err.message.search("responseText\\) is null") != -1) {
                this.http = null; this.priceHtml = "N/A";
            }
            if (!this.priceHtml || this.priceHtml.length == 0)
                this.priceHtml = "N/A";
            this.price = null;
        }
    };

    this.processPrice = function(i, pricenode, first) {
        var tiersEqual = false;
        if (typeof this.dependedPage != 'undefined')
        {
            tiersEqual = this.price == this.dependedPage.price;
            if (tiersEqual)
                this.dependedPage.priceHtml = null;
        }
        var countryName = tiersEqual ? this.globalCountryName : this.countryName;
        var spanId = this.countryCode + "_" + i;
        var html = countryName + ": " + this.priceHtml;
		if (this.price)
		{
			if (this.vat > 0)
				html += " (inc. " + this.vat + "% VAT)";
			if (showYourLocalCurrency)
				html +=  " <span id='" + spanId + "' style='font-weight: bold;'>" + 
					(this.currencyCode != yourLocalCurrency ? this.price : "") + "</span>";
		}
		if (first)
			pricenode.innerHTML = html;
		else
			pricenode.innerHTML += "<br>\n" + html;
		if (this.price)
		{
			if (showYourLocalCurrency && this.currencyCode != yourLocalCurrency) {
				var tmp0 = document.createElement("script");
				tmp0.setAttribute("type", "text/javascript");
				tmp0.innerHTML = "var node = document.getElementById('" + spanId + "');" +
					"node.innerHTML = \"(\" + " + getConvFunction(this.currencyCode, "node") + " + \" " + yourLocalCurrency;
				if (this.vat > 0)
					tmp0.innerHTML += " inc. " + this.vat + "% VAT";
				tmp0.innerHTML += ")\";";
				document.body.insertBefore(tmp0, someNode);
			}
			if (baseCountry.countryCode != this.countryCode)
				createGetDifferenceScript(spanId, this.currencyCode, baseCountry.price, this.price);
		}
    };
}

var usvaluepattern = new RegExp(/&#36;([\d\.]+)/i);
var ukvaluepattern = new RegExp(/&#163;([\d\.]+)/i);
var euvaluepattern = new RegExp(/([\d,-]+)&#8364;/i);
var auvaluepattern = new RegExp(/&#36;([\d\.]+)[\s]USD/i);
var ruvaluepattern = new RegExp(/([\d\.]+) p&#1091;&#1073;./i);
var brvaluepattern = new RegExp(/&#82;&#36; ([\d,]+)/i);

var pageCurrency = null;

var us	= new SteamPage('US',		'us', 'USD', showUSPrice, usvaluepattern, usVat);
var uk	= new SteamPage('UK',		'uk', 'GBP', showUKPrice, ukvaluepattern, 0);
var eu2	= new SteamPage('EU Tier 2', tier2cc, 'EUR', showTieredEuPrices, euvaluepattern, 0);
var eu1	= new SteamPage('EU Tier 1', tier1cc, 'EUR', showTieredEuPrices, euvaluepattern, 0, 'EU', eu2);
var au	= new SteamPage('AU',		'au', 'USD', showAUPrice, auvaluepattern, 0);
var ru	= new SteamPage('RU',		'ru', 'RUB', showRUPrice, ruvaluepattern, 0);
var cis	= new SteamPage('CIS',		CIScc, 'USD', showCISPrice, auvaluepattern, 0);
var br	= new SteamPage('BR',		'br', 'BRL', showBRPrice, brvaluepattern, 0);

var baseCountry = us;
var baseCurrency = baseCountry.currencyCode;
baseCountry.show = true;

var pages = [
    us,
    ru,
    cis,
    br,
    uk,
    eu1,
    eu2,
    au
];

function CurrencyPattern(valuepattern, currencyCode) {
    this.pattern = valuepattern;
    this.currency = currencyCode;
}

var valuepatterns = [ 
	new CurrencyPattern(new RegExp(/\u00A3([\d\.]+)/i), 'GBP'),
	new CurrencyPattern(new RegExp(/([\d,-]+)\u20AC/i), 'EUR'),
	new CurrencyPattern(new RegExp(/\$([\d\.]+)[\s]USD/i), 'USD'),
	new CurrencyPattern(new RegExp(/([\d\.]+) p\u0443\u0431./i), 'RUB'),
	new CurrencyPattern(new RegExp(/R\$ ([\d,]+)/i), 'BRL'),
	new CurrencyPattern(new RegExp(/\$([\d\.]+)/i), 'USD')
];

function detectCurrency(price)
{
	if (pageCurrency != null)
		return;
	price = price.replace(/^\s+|\s+$/g, "");
	for (var i = 0; i < valuepatterns.length; i++)
		if (valuepatterns[i].pattern.exec(price))
		{
			pageCurrency = valuepatterns[i].currency;
			if (yourLocalCurrency == null)
				yourLocalCurrency = pageCurrency;
			return;
		}
}

//Test the URL to see if we're on a game page
if (urlGamePattern.test(document.documentURI) || urlSalePattern.test(document.documentURI))
{
	if (document.body)
		init()
	else
		window.addEventListener('DOMContentLoaded',init,false);
}

function init()
{
    someNode = document.getElementById("global_header");

    //For security reasons, JavaScript code isn't allowed to fetch data from
    //external websites. Instead, we insert a HTML <script> tag that fetches
    //external javascript files. These will help with currency conversion.
    for (var i = 0; i < pages.length; i++)
        if (pages[i].show)
            AddExchangeRateScript(baseCurrency, pages[i].currencyCode, false);	

    var game_purchase_price = false;
    var discount_final_price = false;
    //Test to see if the game has a price
    divnodes = document.getElementsByTagName("div");
    for (i=0; i<divnodes.length; i++) {
        if (divnodes[i].getAttribute("class") == "game_purchase_price price") {
            game_purchase_price = true;
            pricenodes.push(divnodes[i]);
            originalprices.push(divnodes[i].innerHTML);
			detectCurrency(divnodes[i].innerHTML);
            divnodes[i].innerHTML +=
            "<br/><span style='color: rgb(136, 136, 136);'>Collecting data...</span>"
            divnodes[i].style.textAlign = "left";
        }
        if ((divnodes[i].getAttribute("class") == "game_area_dlc_price") && (divnodes[i].innerHTML.indexOf("discount_final_price") == -1)) {
            if (showYourLocalCurrency && pageCurrency != yourLocalCurrency) {
                pricenodes_conly.push(divnodes[i]);
                originalprices_conly.push(divnodes[i].innerHTML);
				detectCurrency(divnodes[i].innerHTML);
                divnodes[i].innerHTML +=
                "<span style='color: rgb(136, 136, 136);'>Collecting data...</span>"
                divnodes[i].style.textAlign = "left";
            }
        } else if ((divnodes[i].getAttribute("class") == "discount_final_price") && (divnodes[i].innerHTML.indexOf("<") == -1)) {
            if (divnodes[i-4].parentNode.className != 'game_area_dlc_price') {
                discount_final_price = true;
                pricenodes.push(divnodes[i]);
                originalprices.push(divnodes[i].innerHTML);
				detectCurrency(divnodes[i].innerHTML);
                divnodes[i].innerHTML +=
                "<br/><span style='color: rgb(136, 136, 136);'>Collecting data...</span>"
                divnodes[i].style.textAlign = "left";
            } else if (showYourLocalCurrency && pageCurrency != yourLocalCurrency) {
                pricenodes_conly.push(divnodes[i]);
                originalprices_conly.push(divnodes[i].innerHTML);
				detectCurrency(divnodes[i].innerHTML);
                divnodes[i].innerHTML +=
                "<span style='color: rgb(136, 136, 136);'> Collecting data...</span>"
                divnodes[i].style.textAlign = "right";
            }
        }
    }

	if (showYourLocalCurrency) {
		for (var j = 0; j < pages.length; j++)
			if (pages[j].show)
				AddExchangeRateScript(pages[j].currencyCode, yourLocalCurrency, true);
		AddExchangeRateScript(pageCurrency, yourLocalCurrency, true);
	}

    //If the current page contains a price,
    //start downloading regional versions of this page
    if ((pricenodes.length > 0) || (pricenodesdlc.length > 0)) {
        //Create cookie that prevents the age verification
        //dialog from breaking the script
        if (document.cookie.indexOf("birthtime") < 0) { //Check if cookie exists
            var date = new Date();
            date.setTime(date.getTime()+(365*24*60*60*1000));//Expires in 365 days
            document.cookie = "birthtime=1; expires=" //birthtime is set to 1 Jan 1900
            + date.toGMTString() + "; path=/"
        }

        //Set up HTTP requests
        for (var i = 0; i < pages.length; i++)
            if (pages[i].show)
            {
                var http = new window.XMLHttpRequest();
                http.onreadystatechange=stateChanged;
                http.open("GET",pages[i].getCountryPageUrl(),true);
                http.send(null);
                pages[i].http = http;
            }

        var style = document.createElement("style");
        style.type = "text/css";
        style.title = 'compareSteamPrices';
        document.getElementsByTagName('head')[0].appendChild(style);

        // Get stylesheet object
        var s;
        for(i in document.styleSheets )
            if( document.styleSheets[i].title == 'compareSteamPrices' )
                s = document.styleSheets[i];

        if (game_purchase_price)
            s.insertRule(".game_area_purchase_game .game_purchase_action{height:auto;bottom:auto}", s.cssRules.length);
        if (discount_final_price)
            s.insertRule(".game_purchase_action  .game_purchase_price, .game_purchase_discount{height:auto;padding-bottom:8px}", s.cssRules.length);
        s.insertRule(".game_purchase_action_bg{height:auto;bottom:auto!important}", s.cssRules.length);
        s.insertRule(".game_purchase_action  .game_purchase_price{height:auto;padding-bottom:8px}", s.cssRules.length);

        var margin = 14;
        for (var i = 0; i < pages.length; i++)
            if (pages[i].show)
                margin += 16;
        s.insertRule(".game_area_purchase_game,.sale_page_purchase_package{margin-bottom:"+margin+"px!important}", s.cssRules.length);
        s.insertRule(".block.block_content{margin-bottom:"+margin+"px!important}", s.cssRules.length);
    }
}

function getConvFunction(currency, id)
{
    if (currency != yourLocalCurrency)
        return "Math.round(" + currency + "to" + yourLocalCurrency + "(" + id + ".innerHTML * 100))/100";
    else
        return id + ".innerHTML";
}

//Extracts prices from the downloaded HTML and displays them
function stateChanged() {
    //Check to see of all scripts have completed
    for (var i = 0; i < pages.length; i++)
        if (pages[i].show && (!pages[i].http || pages[i].http.readyState != 4))
            return;
    //All requests completed, good to go

    //The pattern variables can't be reused because it's global, so just duplicate
    for (var i = 0; i < pages.length; i++)
        if (pages[i].show)
        {
            pages[i].pricepattern = new RegExp(/<div class="(?:game_purchase_price price|discount_final_price)"[^>]*>([^<]+?)<\/div>/gi);
        }

    var calcscript = "function getDifference(currency, usdPrice, localPrice) " +
        "{\n" +
        "  var usdConverted; var lessmore; var diff;\n" +
        "  if (currency == 'GBP') {usdConverted = " + baseCurrency + "toGBP(usdPrice);}\n" +
        "  else if (currency == 'EUR') {usdConverted = " + baseCurrency + "toEUR(usdPrice);}\n" +
        "  else if (currency == 'RUB') {usdConverted = " + baseCurrency + "toRUB(usdPrice);}\n" +
        "  else if (currency == 'BRL') {usdConverted = " + baseCurrency + "toBRL(usdPrice);}\n" +
        "  else if (currency == 'USD') {usdConverted = " + baseCurrency + "toUSD(usdPrice);}\n" +
        "  diff = Math.abs((localPrice/usdConverted)*100-100);\n" +

        "  if (localPrice == usdConverted) {lessmore = '<img src=\"http://www.steamunpowered.eu/orangebar.png\" width=\"9\" height=\"5\" border=\"0\">';}\n" +
        "  else if (localPrice > usdConverted) {lessmore = '<img src=\"http://www.steamunpowered.eu/uparrow.png\" width=\"7\" height=\"9\" border=\"0\">';}\n" +
        "  else {lessmore = '<img src=\"http://www.steamunpowered.eu/downarrow.png\" width=\"7\" height=\"9\" border=\"0\">';}\n" +

        " if (localPrice == usdConverted) {return ' <span style=\"color: #ac9b09; font-weight: normal\">(' + lessmore + ')</span>';}\n" +
        " else if (localPrice > usdConverted) {return '  <span style=\"color: #f00; font-weight: normal\">(' + Math.round(diff) + '% ' + lessmore + ')</span>'}\n" +
        " else return ' <span style=\"color: #4fc20f; font-weight: normal\">(' + Math.round(diff) + '% ' + lessmore + ')</span>';}\n";

    var calcscript_opera = "function getDifference(currency, usdPrice, localPrice) " +
        "{\n" +
        "  var usdConverted; var lessmore; var diff;\n" +
        "  if (currency == 'GBP') {usdConverted = " + baseCurrency + "toGBP(usdPrice);}\n" +
        "  else if (currency == 'EUR') {usdConverted = " + baseCurrency + "toEUR(usdPrice);}\n" +
        "  else if (currency == 'RUB') {usdConverted = " + baseCurrency + "toRUB(usdPrice);}\n" +
        "  else if (currency == 'BRL') {usdConverted = " + baseCurrency + "toBRL(usdPrice);}\n" +
        "  else if (currency == 'USD') {usdConverted = " + baseCurrency + "toUSD(usdPrice);}\n" +
        "  diff = Math.abs((localPrice/usdConverted)*100-100);\n" +

        "  if (localPrice == usdConverted) {lessmore = 'prices are equal'; return ' (' + lessmore + ')';} \n" +
        "  else if (localPrice > usdConverted) {lessmore = 'higher';}\n" +
        "  else {lessmore = 'lower';}\n" +
        "  return ' (' + Math.round(diff) + '% ' + lessmore + ')';}\n";	

    var calculatescript = document.createElement("script");
    calculatescript.setAttribute("type", "text/javascript");
    //Shitty Opera browser detection
    if (window.navigator.appName == "Opera") { 
        calculatescript.innerHTML = calcscript_opera; 
    } else {
        calculatescript.innerHTML = calcscript;
    }
    document.body.insertBefore(calculatescript, someNode);

    if (showYourLocalCurrency && pageCurrency != yourLocalCurrency) {
		//For DLC on game page
		var mypriceHtml_conly;
		var myprice_conly;

		for (i = 0; i < pricenodes_conly.length; i++) {
			try {
				var myvaluepattern_conly = new RegExp(/([\d]+([,\.](\d\d|--))?)/i);
				mypriceHtml_conly = originalprices_conly[i];
				myprice_conly = parseFloat(myvaluepattern_conly.exec(originalprices_conly[i])[1].replace(",", ".").replace("--", "00"));
			}
			catch(err) {
				if (!mypriceHtml_conly || mypriceHtml_conly.length == 0)
					mypriceHtml_conly = "N/A";
				myprice_conly = null;
			}
			if (showYourLocalCurrency) {
				pricenodes_conly[i].innerHTML = mypriceHtml_conly + " <span id='dlc" + i + "' style='font-weight: bold; color: rgb(136, 136, 136);'>" + myprice_conly + "</span>";	  
				var dlc00 = document.createElement("script");
				dlc00.setAttribute("type", "text/javascript");
				dlc00.innerHTML = "var dlc = document.getElementById('dlc" + i + "');" + 
				"dlc.innerHTML = \"(\" + " + getConvFunction(pageCurrency, "dlc") + " + \" " + yourLocalCurrency + ")\";"; 
				document.body.insertBefore(dlc00, someNode);
			}
		}
	}

    var mypriceHtml;
    var myprice;

    for (i=0; i<pricenodes.length; i++) {	
        try {
            var myvaluepattern = new RegExp(/([\d]+([,\.](\d\d|--))?)/i);
            mypriceHtml = originalprices[i];
            myprice = parseFloat(myvaluepattern.exec(originalprices[i])[1].replace(",", ".").replace("--", "00"));
        }
        catch(err) {
            if (!mypriceHtml || mypriceHtml.length == 0)
                mypriceHtml = "N/A";
            myprice = null;
        }
        for (var j = 0; j < pages.length; j++)
            pages[j].findPrice();
        var first = true;
        var displayOnlyBase = true;
        for (var j = 0; j < pages.length; j++)
            if (pages[j].show && pages[j].priceHtml) {
                pages[j].processPrice(i, pricenodes[i], first);
                if (baseCountry.countryCode != pages[j].countryCode)
                    displayOnlyBase = false;
                first = false;
            }
          
        if (displayOnlyBase) { //Ignore country codes, only display price for YOUR region
            if (showYourLocalCurrency && (myprice != null)) {
                pricenodes[i].innerHTML += "<br>\nYou: " + mypriceHtml + " <span id='myprice" + i + "' style='font-weight: bold;'>" + myprice + "</span>";
                var tmp1 = document.createElement("script");
                tmp1.setAttribute("type", "text/javascript");
                tmp1.innerHTML = "var myprice = document.getElementById('myprice" + i + "');" +
                "myprice.innerHTML = \"(\" + " + getConvFunction(baseCountry.currencyCode, "myprice") + " + \" " + yourLocalCurrency + ")\";";
                document.body.insertBefore(tmp1, someNode);
                createGetDifferenceScript("myprice" + i, baseCountry.currencyCode, baseCountry.price, myprice);
            } else {
                pricenodes[i].innerHTML += "<br>\nYou: " + mypriceHtml
                + " <span id='myprice" + i + "'></span>";
                createGetDifferenceScript("myprice" + i, baseCountry.currencyCode, baseCountry.price, myprice);
            }
        }
    }

    //Remove cookie that may store the wrong currency for this region
    document.cookie = "fakeCC=; expires=Fri, 27 Jul 2001 02:47:11 UTC; path=/";
}

function createGetDifferenceScript(elementid, currencystring, basePrice, localPrice) {
    if (basePrice && localPrice) {
        var getdiff = document.createElement("script");
        getdiff.setAttribute("type", "text/javascript");
        getdiff.innerHTML += "var node = document.getElementById('" + elementid
            + "');" + "if (node)"
            + "node.innerHTML += getDifference('" + currencystring + "', " + basePrice +
            ", " + localPrice + ");";
        document.body.insertBefore(getdiff, someNode);
    }
}