const id = (name) => document.getElementById(name)
const cl = (name) => document.getElementsByClassName(name)
const clas = (that, val) => that.setAttribute('class', val)
const has = (that, val) => (id(that) && id(that).getAttribute('class') === val ? true : false)

let disposableData = {},
	isPro = false,
	langue = 'en',
	stillActive = false,
	rangeActive = false,
	lazyClockInterval = 0,
	fontList = [],
	fullImage = [],
	fullThumbnails = []
const randomseed = Math.floor(Math.random() * 30) + 1,
	domshowsettings = id('showSettings'),
	domlinkblocks = id('linkblocks'),
	dominterface = id('interface'),
	dict = askfordict(),
	domimg = id('background'),
	domthumbnail = cl('thumbnail'),
	domclock = id('clock'),
	mobilecheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? true : false

//cache rapidement temp max pour eviter que ça saccade
if (new Date().getHours() >= 12) id('temp_max_wrap').style.display = 'none'

//c'est juste pour debug le storage
function deleteBrowserStorage() {
	chrome.storage.sync.clear(() => {
		localStorage.clear()
	})
}

function getBrowserStorage(callback) {
	chrome.storage.sync.get(null, (data) => {
		if (callback) callback(data)
		else console.log(data)
	})
}

function getLocalStorage() {
	chrome.storage.local.get(null, (data) => {
		console.log(data)
	})
}

//cache un peu mieux les données dans le storage
function localEnc(input = 'no', enc = true) {
	let a = input.split(''),
		n = ''
	for (let i in a) n += String.fromCharCode(a[i].charCodeAt() + (enc ? randomseed : -randomseed))
	return n
}

function slowRange(tosave, time = 150) {
	//timeout avant de save pour éviter la surcharge d'instructions de storage
	clearTimeout(rangeActive)
	rangeActive = setTimeout(function () {
		chrome.storage.sync.set(tosave)
	}, time)
}

function slow(that) {
	that.setAttribute('disabled', '')
	stillActive = setTimeout(() => {
		that.removeAttribute('disabled')
		clearTimeout(stillActive)
		stillActive = false
	}, 700)
}

function traduction(ofSettings, initStorage) {
	let trns = (ofSettings ? id('settings') : document).querySelectorAll('.trn')
	langue = ofSettings ? JSON.parse(localEnc(disposableData, false)).lang || 'en' : initStorage || 'en'

	if (langue !== 'en') trns.forEach((t) => (dict[t.innerText] ? (t.innerText = dict[t.innerText][langue]) : ''))
}

function tradThis(str) {
	if (langue === 'en') return str
	else return dict[str][langue]
}

function newClock(eventObj, init) {
	function displayControl() {
		const numeric = id('clock'),
			analog = id('analogClock'),
			analSec = id('analogSeconds')

		//cache celle qui n'est pas choisi
		clas(clock.analog ? numeric : analog, 'hidden')
		clas(clock.analog ? analog : numeric, '')

		//cache l'aiguille des secondes
		if (!clock.seconds && clock.analog) clas(analSec, 'hidden')
		else clas(analSec, '')
	}

	function main(change) {
		//retourne une liste [heure, minutes, secondes]
		function time() {
			const date = new Date()
			return [date.getHours(), date.getMinutes(), date.getSeconds()]
		}

		//besoin pour numerique et analogue
		function timezone(timezone, hour) {
			if (timezone === 'auto' || timezone === NaN) return hour
			else {
				let d = new Date()
				let offset = d.getTimezoneOffset()
				let utc = hour + offset / 60
				let setTime = (utc + parseInt(timezone)) % 24

				if (setTime < 0) setTime = 24 + setTime

				return setTime
			}
		}

		function numerical(timearray) {
			//seul numerique a besoin du ampm
			function toAmpm(val) {
				if (val > 12) val -= 12
				else if (val === 0) val = 12
				else val

				return val
			}

			function fixunits(val) {
				val = val < 10 ? '0' + val : val
				return val.toString()
			}

			let h = clock.ampm ? toAmpm(timearray[0]) : timearray[0],
				m = fixunits(timearray[1]),
				s = fixunits(timearray[2])

			if (clock.seconds) {
				domclock.innerText = `${h}:${m}:${s}`
			} else if (change || domclock.innerText.length === 0 || s === '00') {
				domclock.innerText = `${h}:${m}`
			}
		}

		function analog(timearray) {
			function rotation(that, val) {
				const spancss = that.style

				if (lazyClockInterval === 0 || val === 0) {
					spancss.transition = 'none'
				} else {
					if (spancss.transition === 'none 0s ease 0s') spancss.transition = 'transform .1s'
				}

				spancss.transform = `rotate(${parseInt(val)}deg)`
			}

			let s = timearray[2] * 6,
				m = timearray[1] * 6, // + (s / 60),
				h = timearray[0] * 30 //% 12 / 12 * 360 + (m / 12);

			//bouge les aiguilles minute et heure quand seconde ou minute arrive à 0
			if (true || timearray[2] === 0) rotation(id('minutes'), m)
			if (true || timearray[1] === 0) rotation(id('hours'), h)

			//tourne pas les secondes si pas de seconds
			if (clock.seconds) rotation(id('analogSeconds'), s)
		}

		//timezone control
		//analog control
		const array = time()

		array[0] = timezone(clock.timezone, array[0])
		clock.analog ? analog(array) : numerical(array)
	}

	function startClock(change) {
		//stops multiple intervals
		clearInterval(lazyClockInterval)

		displayControl()
		main(change)
		lazyClockInterval = setInterval(main, 1000)
	}

	//controle très stricte de clock comme vous pouvez le voir
	//(je sais que je peux faire mieux)
	let clock

	if (eventObj) {
		chrome.storage.sync.get('clock', (data) => {
			clock = {
				analog: data.clock ? data.clock.analog : false,
				seconds: data.clock ? data.clock.seconds : false,
				ampm: data.clock ? data.clock.ampm : false,
				timezone: data.clock ? data.clock.timezone : 'auto',
			}

			//event change of clock parameters
			clock[eventObj.param] = eventObj.value
			chrome.storage.sync.set({ clock: clock })

			startClock(true)
		})
	} else {
		clock = {
			analog: init ? init.analog : false,
			seconds: init ? init.seconds : false,
			ampm: init ? init.ampm : false,
			timezone: init ? init.timezone : 'auto',
		}

		startClock(true)
	}
}

function date(event, usdate) {
	const date = new Date()
	const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
	const months = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	]

	if (usdate) {
		id('jour').innerText = tradThis(days[date.getDay()]) + ','
		id('chiffre').innerText = tradThis(months[date.getMonth()])
		id('mois').innerText = date.getDate()
	} else {
		id('jour').innerText = tradThis(days[date.getDay()])
		id('chiffre').innerText = date.getDate()
		id('mois').innerText = tradThis(months[date.getMonth()])
	}

	if (event) chrome.storage.sync.set({ usdate: usdate })
}

function greetings() {
	const h = new Date().getHours()
	let message

	if (h > 6 && h < 12) message = 'Good Morning'
	else if (h >= 12 && h < 18) message = 'Good Afternoon'
	else if (h >= 18 && h <= 23) message = 'Good Evening'
	else message = 'Good Night'

	id('greetings').innerText = tradThis(message)
}

function quickLinks(event, that, initStorage) {
	// Pour ne faire qu'un seul storage call
	// [{ index: number, url: string }]
	const linksFaviconsToUpdate = []

	//enleve les selections d'edit
	const removeLinkSelection = () =>
		domlinkblocks.querySelectorAll('.l_icon_wrap').forEach(function (e) {
			clas(e, 'l_icon_wrap')
		})

	//initialise les blocs en fonction du storage
	//utilise simplement une boucle de appendblock
	function initblocks(storage) {
		let array = storage.links || false
		if (array) array.map((a, i) => appendblock(a, i, array))
	}

	function addIcon(elem, arr, index, links) {
		//prend le domaine de n'importe quelle url
		const a = document.createElement('a')
		a.href = arr.url
		const hostname = a.hostname

		// fetch l'icône et l'ajoute
		const img = new Image()
		const url = 'https://api.faviconkit.com/' + hostname + '/144'

		img.onload = () => {
			// Change to loaded favicon
			elem.querySelector('img').src = url

			// Save changes memory var
			linksFaviconsToUpdate.push({ index, url })
			const howManyToSave = links.filter((link) => link.icon === 'src/images/icons/favicon.png')

			// Last to save ? Update storage
			if (linksFaviconsToUpdate.length === howManyToSave.length) {
				linksFaviconsToUpdate.forEach((link) => (links[link.index].icon = link.url))
				chrome.storage.sync.set({ links: links })
			}
		}
		img.src = url
		img.remove()
	}

	function appendblock(arr, index, links) {
		let { icon, title, url } = arr

		// no icon ? + 1.9.2 dead favicons fix
		if (icon.length === 0 || icon === 'src/images/icons/favicon.png') {
			icon = 'src/assets/images/loading.gif'
		}

		//le DOM du block
		let b = `<div class='block' draggable="false" source='${url}'>
			<div class='l_icon_wrap' draggable="false">
				<img class='l_icon' src='${icon}' draggable="false">
			</div>
			<span>${title}</span>
		</div>`

		//ajoute un wrap
		let block_parent = document.createElement('div')
		block_parent.setAttribute('class', 'block_parent')
		block_parent.setAttribute('draggable', 'true')
		block_parent.innerHTML = b

		//l'ajoute au dom
		domlinkblocks.appendChild(block_parent)

		//met les events au dernier elem rajouté
		addEvents(domlinkblocks.lastElementChild)

		//si online et l'icon charge, en rechercher une
		const imageLoading = icon === 'src/assets/images/loading.gif'
		if (window.navigator.onLine && imageLoading) addIcon(domlinkblocks.lastElementChild, arr, index, links)
	}

	function addEvents(elem) {
		function handleDrag(is, that) {
			chrome.storage.sync.get('links', (data) => {
				const i = findindex(that)
				let hovered, dragged, current

				if (is === 'start') dragged = [elem, data.links[i], i]
				else if (is === 'enter') hovered = [elem, data.links[i], i]
				else if (is === 'end') {
					//changes html blocks
					current = hovered[0].innerHTML
					hovered[0].innerHTML = dragged[0].innerHTML
					dragged[0].innerHTML = current

					//changes link storage
					let allLinks = data.links

					allLinks[dragged[2]] = hovered[1]
					allLinks[hovered[2]] = dragged[1]

					chrome.storage.sync.set({ links: allLinks })
				}
			})
		}

		elem.ondragstart = function (e) {
			//e.preventDefault();
			e.dataTransfer.setData('text/plain', e.target.id)
			e.currentTarget.style.cursor = 'pointer'
			handleDrag('start', this)
		}

		elem.ondragenter = function (e) {
			e.preventDefault()
			handleDrag('enter', this)
		}

		elem.ondragend = function (e) {
			e.preventDefault()
			handleDrag('end', this)
		}

		elem.oncontextmenu = function (e) {
			e.preventDefault()
			if (mobilecheck) editlink(this)
		}

		elem.onmouseup = function (e) {
			removeLinkSelection()
			e.which === 3 ? editlink(this) : !has('settings', 'shown') ? openlink(this, e) : ''
		}
	}

	function editEvents() {
		id('e_delete').onclick = function () {
			removeLinkSelection()
			removeblock(parseInt(id('edit_link').getAttribute('index')))
			clas(id('edit_linkContainer'), '')
		}

		id('e_submit').onclick = function () {
			removeLinkSelection()
			editlink(null, parseInt(id('edit_link').getAttribute('index')))
			clas(id('edit_linkContainer'), '')
		}

		id('e_close').onmouseup = function () {
			removeLinkSelection()
			clas(id('edit_linkContainer'), '')
		}

		id('re_title').onmouseup = function () {
			id('e_title').value = ''
		}

		id('re_url').onmouseup = function () {
			id('e_url').value = ''
		}

		id('re_iconurl').onmouseup = function () {
			id('e_iconurl').value = ''
		}
	}

	function editlink(that, i) {
		const e_title = id('e_title')
		const e_url = id('e_url')
		const e_iconurl = id('e_iconurl')

		const updateLinkHTML = ({ title, url, icon }) => {
			let block = domlinkblocks.children[i + 1]

			block.children[0].setAttribute('source', url)
			block.children[0].lastChild.innerText = title
			block.querySelector('img').src = icon
		}

		//edit est visible
		if (i || i === 0) {
			chrome.storage.sync.get('links', (data) => {
				let allLinks = [...data.links]
				let element = {
					title: e_title.value,
					url: e_url.value,
					icon: e_iconurl.value,
				}

				allLinks[i] = element
				updateLinkHTML(element)
				chrome.storage.sync.set({ links: allLinks })
			})

			//affiche edit avec le bon index
		} else {
			const index = findindex(that)
			const liconwrap = that.querySelector('.l_icon_wrap')

			clas(liconwrap, 'l_icon_wrap selected')

			if (has('settings', 'shown')) clas(id('edit_linkContainer'), 'shown pushed')
			else clas(id('edit_linkContainer'), 'shown')

			id('edit_link').setAttribute('index', index)

			chrome.storage.sync.get('links', (data) => {
				const { title, url, icon } = data.links[index]

				e_title.setAttribute('placeholder', tradThis('Title'))
				e_iconurl.setAttribute('placeholder', tradThis('Icon'))

				e_title.value = title
				e_url.value = url
				e_iconurl.value = icon
			})
		}
	}

	function findindex(that) {
		//passe la liste des blocks, s'arrete si that correspond
		//renvoie le nombre de loop pour l'atteindre

		const list = domlinkblocks.children

		for (let i = 0; i < list.length; i++) if (that === list[i]) return i - 1
	}

	function removeblock(index) {
		let count = index

		chrome.storage.sync.get(['links', 'searchbar'], (data) => {
			function ejectIntruder(arr) {
				if (arr.length === 1) return []

				if (count === 0) arr.shift()
				else if (count === arr.length) arr.pop()
				else arr.splice(count, 1)

				return arr
			}

			var linkRemd = ejectIntruder(data.links)

			//si on supprime un block quand la limite est atteinte
			//réactive les inputs
			if (linkRemd.length === 16 - 1) id('i_url').removeAttribute('disabled')

			//enleve le html du block
			var block_parent = domlinkblocks.children[count + 1]
			block_parent.setAttribute('class', 'block_parent removed')

			setTimeout(function () {
				domlinkblocks.removeChild(block_parent)

				//enleve linkblocks si il n'y a plus de links
				if (linkRemd.length === 0) domlinkblocks.style.visibility = 'hidden'
			}, 200)

			chrome.storage.sync.set({ links: linkRemd })
		})
	}

	function linkSubmission() {
		function filterUrl(str) {
			let reg = new RegExp('^(http|https)://', 'i')

			//config ne marche pas
			if (str.startsWith('about:') || str.startsWith('chrome://')) return false

			if (str.startsWith('file://')) return str

			//premier regex pour savoir si c'est http
			if (!str.match(reg)) str = 'http://' + str

			//deuxieme pour savoir si il est valide (avec http)
			if (str.match(reg)) return str.match(reg).input
			else return false
		}

		function saveLink(lll) {
			slow(id('i_url'))

			//remet a zero les inputs
			id('i_title').value = ''
			id('i_url').value = ''

			let full = false

			chrome.storage.sync.get(['links', 'searchbar'], (data) => {
				let arr = []

				//array est tout les links + le nouveau
				if (data.links && data.links.length > 0) {
					if (data.links.length < 16 - 1) {
						arr = data.links
						arr.push(lll)
					} else {
						full = true
					}

					//array est seulement le link
				} else {
					arr.push(lll)
					domlinkblocks.style.visibility = 'visible'
				}

				//si les blocks sont moins que 16
				if (!full) {
					chrome.storage.sync.set({ links: arr })
					appendblock(lll, arr.length - 1, arr)
				} else {
					//desactive tout les input url
					id('i_url').setAttribute('disabled', 'disabled')
				}
			})
		}

		const titleControl = (t) => (t.length > 42 ? t.slice(0, 42) + '...' : t)

		//append avec le titre, l'url ET l'index du bloc

		let links = {
			title: titleControl(id('i_title').value),
			url: filterUrl(id('i_url').value),
			icon: '',
		}

		//si l'url filtré est juste
		if (links.url && id('i_url').value.length > 2) {
			//et l'input n'a pas été activé ya -1s
			if (!stillActive) saveLink(links)
		}
	}

	function openlink(that, e) {
		const source = that.children[0].getAttribute('source')
		const a_hiddenlink = id('hiddenlink')

		chrome.storage.sync.get('linknewtab', (data) => {
			if (data.linknewtab) {
				chrome.tabs.create({
					url: source,
				})
			} else {
				if (e.which === 2) {
					chrome.tabs.create({
						url: source,
					})
				} else {
					a_hiddenlink.setAttribute('href', source)
					a_hiddenlink.setAttribute('target', '_self')
					a_hiddenlink.click()
				}
			}
		})
	}

	//TOUT LES EVENTS, else init

	if (event === 'input' && that.which === 13) linkSubmission()
	else if (event === 'button') linkSubmission()
	else if (event === 'linknewtab') {
		chrome.storage.sync.set({ linknewtab: that.checked ? true : false })
		id('hiddenlink').setAttribute('target', '_blank')
	} else {
		initblocks(initStorage)
		editEvents()
		id('edit_linkContainer').oncontextmenu = (e) => e.preventDefault()
	}
}

function weather(event, that, initStorage) {
	const dom_temp_max = id('temp_max'),
		dom_temp_max_wrap = id('temp_max_wrap'),
		dom_first_desc = id('weather_desc').children[0]

	function cacheControl(storage) {
		let now = Math.floor(new Date().getTime() / 1000)
		let param = storage.weather ? storage.weather : ''

		if (storage.weather && storage.weather.lastCall) {
			//si weather est vieux d'une demi heure (1800s)
			//ou si on change de lang
			//faire une requete et update le lastcall
			if (sessionStorage.lang || now > storage.weather.lastCall + 1800) {
				dataHandling(param.lastState)
				request(param, 'current')

				//si la langue a été changé, suppr
				if (sessionStorage.lang) sessionStorage.removeItem('lang')
			} else dataHandling(param.lastState)

			//high ici
			if (storage.weather && storage.weather.fcDay === new Date().getDay()) {
				dom_temp_max.innerText = storage.weather.fcHigh + '°'
				dom_temp_max_wrap.style.opacity = 1
			} else request(storage.weather, 'forecast')
		} else {
			//initialise a Paris + Metric
			//c'est le premier call, requete + lastCall = now
			initWeather()
		}
	}

	function initWeather() {
		let param = {
			city: 'Paris',
			ccode: 'FR',
			location: [],
			unit: 'metric',
		}

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				//update le parametre de location
				param.location.push(pos.coords.latitude, pos.coords.longitude)
				chrome.storage.sync.set({ weather: param })

				request(param, 'current')
				request(param, 'forecast')
			},
			(refused) => {
				chrome.storage.sync.set({ weather: param })

				request(param, 'current')
				request(param, 'forecast')
			}
		)
	}

	function request(arg, wCat) {
		function urlControl(arg, forecast) {
			let url = 'https://api.openweathermap.org/data/2.5/'

			if (forecast) url += 'forecast?appid=' + atob(WEATHER_API_KEY[0])
			else url += 'weather?appid=' + atob(WEATHER_API_KEY[1])

			//auto, utilise l'array location [lat, lon]
			if (arg.location) {
				url += `&lat=${arg.location[0]}&lon=${arg.location[1]}`
			} else {
				url += `&q=${encodeURI(arg.city)},${arg.ccode}`
			}

			url += `&units=${arg.unit}&lang=${langue}`

			return url
		}

		function weatherResponse(parameters, response) {
			//sauvegarder la derniere meteo
			let now = Math.floor(new Date().getTime() / 1000)
			let param = parameters
			param.lastState = response
			param.lastCall = now
			chrome.storage.sync.set({ weather: param })

			//la réponse est utilisé dans la fonction plus haute
			dataHandling(response)
		}

		function forecastResponse(parameters, response) {
			function findHighTemps(d) {
				let i = 0
				let newDay = new Date(d.list[0].dt_txt).getDay()
				let currentDay = newDay
				let arr = []

				//compare la date toute les 3h (list[i])
				//si meme journée, rajouter temp max a la liste

				while (currentDay == newDay && i < 10) {
					newDay = new Date(d.list[i].dt_txt).getDay()
					arr.push(d.list[i].main.temp_max)

					i += 1
				}

				let high = Math.floor(Math.max(...arr))

				//renvoie high
				return [high, currentDay]
			}

			let fc = findHighTemps(response)

			//sauvegarder la derniere meteo
			let param = parameters
			param.fcHigh = fc[0]
			param.fcDay = fc[1]
			chrome.storage.sync.set({ weather: param })

			dom_temp_max.innerText = param.fcHigh + '°'
			dom_temp_max_wrap.style.opacity = 1
		}

		let url = wCat === 'current' ? urlControl(arg, false) : urlControl(arg, true)

		let request_w = new XMLHttpRequest()
		request_w.open('GET', url, true)

		request_w.onload = function () {
			let resp = JSON.parse(this.response)

			if (request_w.status >= 200 && request_w.status < 400) {
				if (wCat === 'current') {
					weatherResponse(arg, resp)
				} else if (wCat === 'forecast') {
					forecastResponse(arg, resp)
				}
			} else {
				submissionError(resp.message)
			}
		}

		request_w.send()
	}

	function dataHandling(data) {
		let hour = new Date().getHours()

		function getIcon() {
			//si le soleil est levé, renvoi jour
			//le renvoie correspond au nom du répertoire des icones jour / nuit
			function dayOrNight(sunset, sunrise) {
				let ss = new Date(sunset * 1000)
				let sr = new Date(sunrise * 1000)

				return hour > sr.getHours() && hour < ss.getHours() ? 'day' : 'night'
			}

			//prend l'id de la météo et renvoie une description
			//correspond au nom de l'icone (+ .png)
			function imgId(c) {
				let temp,
					codes = {
						thunderstorm: 200,
						lightdrizzle: 300,
						showerdrizzle: 302,
						lightrain: 500,
						showerrain: 502,
						snow: 602,
						mist: 701,
						clearsky: 800,
						fewclouds: 801,
						brokenclouds: 803,
					}

				for (let key in codes) {
					if (c >= codes[key]) temp = key
				}

				return temp || 'clearsky'
			}

			let d_n = dayOrNight(data.sys.sunset, data.sys.sunrise)
			let weather_id = imgId(data.weather[0].id)
			let icon_src = `src/assets/images/weather/${d_n}/${weather_id}.png`
			id('widget').setAttribute('src', icon_src)
			id('widget').setAttribute('class', 'shown')
		}

		function getDescription() {
			//pour la description et temperature
			//Rajoute une majuscule à la description
			let meteoStr = data.weather[0].description
			meteoStr = meteoStr[0].toUpperCase() + meteoStr.slice(1)
			id('desc').innerText = meteoStr + '.'

			//si c'est l'après midi (apres 12h), on enleve la partie temp max
			let dtemp, wtemp

			if (hour < 12) {
				//temp de desc et temp de widget sont pareil
				dtemp = wtemp = Math.floor(data.main.temp) + '°'
			} else {
				//temp de desc devient temp de widget + un point
				//on vide la catégorie temp max
				wtemp = Math.floor(data.main.temp) + '°'
				dtemp = wtemp + '.'
			}

			id('temp').innerText = dtemp
			id('widget_temp').innerText = wtemp
			dom_first_desc.style.opacity = 1
		}

		getDescription()
		getIcon()
	}

	function submissionError(error) {
		const city = id('i_city')

		city.value = ''
		city.setAttribute('placeholder', tradThis('City not found'))
	}

	function updateCity() {
		slow(that)

		chrome.storage.sync.get('weather', (data) => {
			const param = data.weather

			param.ccode = i_ccode.value
			param.city = i_city.value

			if (param.city.length < 2) return false

			request(param, 'current')
			request(param, 'forecast')

			i_city.setAttribute('placeholder', param.city)
			i_city.value = ''
			i_city.blur()

			chrome.storage.sync.set({
				weather: param,
			})
		})
	}

	function updateUnit(that) {
		slow(that)

		chrome.storage.sync.get(['weather'], (data) => {
			const param = data.weather

			if (that.checked) {
				param.unit = 'imperial'
			} else {
				param.unit = 'metric'
			}

			request(param, 'current')
			request(param, 'forecast')

			chrome.storage.sync.set({ weather: param })
		})
	}

	function updateLocation(that) {
		slow(that)

		chrome.storage.sync.get('weather', (data) => {
			const param = data.weather
			param.location = []

			if (that.checked) {
				that.setAttribute('disabled', '')

				navigator.geolocation.getCurrentPosition(
					(pos) => {
						//update le parametre de location
						param.location.push(pos.coords.latitude, pos.coords.longitude)

						chrome.storage.sync.set({
							weather: param,
						})

						//request la meteo
						request(param, 'current')
						request(param, 'forecast')

						//update le setting
						clas(sett_city, 'city hidden')
						that.removeAttribute('disabled')
					},
					(refused) => {
						//désactive geolocation if refused
						that.checked = false
						that.removeAttribute('disabled')

						if (!param.city) initWeather()
					}
				)
			} else {
				clas(sett_city, 'city')

				i_city.setAttribute('placeholder', param.city)
				i_ccode.value = param.ccode

				param.location = false

				chrome.storage.sync.set({
					weather: param,
				})

				request(param, 'current')
				request(param, 'forecast')
			}
		})
	}

	const WEATHER_API_KEY = [
		'YTU0ZjkxOThkODY4YTJhNjk4ZDQ1MGRlN2NiODBiNDU=',
		'Y2U1M2Y3MDdhZWMyZDk1NjEwZjIwYjk4Y2VjYzA1NzE=',
		'N2M1NDFjYWVmNWZjNzQ2N2ZjNzI2N2UyZjc1NjQ5YTk=',
	]
	const i_city = id('i_city')
	const i_ccode = id('i_ccode')
	const sett_city = id('sett_city')

	//TOUT LES EVENTS, default c'est init
	switch (event) {
		case 'city':
			updateCity()
			break

		case 'units':
			updateUnit(that)
			break

		case 'geol':
			updateLocation(that)
			break

		default:
			cacheControl(initStorage)
	}
}

function imgCredits(src, type) {
	const location = id('location'),
		artist = id('artist'),
		credit = id('credit'),
		onUnsplash = id('onUnsplash')

	if (type === 'dynamic') {
		clas(onUnsplash, 'shown')
		location.innerText = src.location.text
		location.setAttribute('href', src.location.url)
		artist.innerText = src.artist.text
		artist.setAttribute('href', src.artist.url)
	}

	if (type === 'custom') clas(credit, 'hidden')
	else clas(credit, 'shown')
}

function imgBackground(val) {
	if (val) {
		let img = new Image()

		img.onload = () => {
			id('background').style.backgroundImage = `url(${val})`
			id('background_overlay').style.animation = 'fade .1s ease-in forwards'
		}

		img.src = val
		img.remove()
	} else return id('background').style.backgroundImage
}

function initBackground(storage) {
	function loadCustom({ custom, customIndex }) {
		const index = customIndex >= 0 ? customIndex : 0
		const chosen = custom[index]
		const cleanData = chosen.slice(chosen.indexOf(',') + 1, chosen.length)

		imgBackground(b64toBlobUrl(cleanData))
		changeImgIndex(customIndex)
	}

	let type = storage.background_type || 'dynamic'

	if (type === 'custom') {
		//reste local !!!!
		chrome.storage.local.get(null, (localChrome) => {
			//1.8.3 -> 1.9 data transfer
			if (localChrome.background_blob !== undefined) {
				const blob = localChrome.background_blob
				const old = [blob[0] + ',' + blob[1]]

				loadCustom({
					custom: old,
					customIndex: 0,
				})

				chrome.storage.local.set({ custom: old, customIndex: 0, customThumbnails: old })
				chrome.storage.local.remove('background_blob')
			} else if (Object.entries(localChrome).length > 0) {
				//apply chosen custom background
				loadCustom(localChrome)
			} else {
				//if no custom background available: dynamic
				unsplash(storage)
				chrome.storage.sync.set({ background_type: 'dynamic' })
			}
		})

		imgCredits(null, type)
	} else if (type === 'dynamic' || type === 'default') {
		unsplash(storage)
	} else {
		//on startup
		unsplash(null, null, true)
	}

	const blur = storage.background_blur !== undefined ? storage.background_blur : 15
	const bright = storage.background_bright !== undefined ? storage.background_bright : 0.7

	filter('init', [parseFloat(blur), parseFloat(bright)])
}

function setblob(donnee, reader) {
	const b64toBlob = (b64Data, contentType = '', sliceSize = 512) => {
		const byteCharacters = atob(b64Data)
		const byteArrays = []

		for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
			const slice = byteCharacters.slice(offset, offset + sliceSize)

			const byteNumbers = new Array(slice.length)
			for (let i = 0; i < slice.length; i++) {
				byteNumbers[i] = slice.charCodeAt(i)
			}

			const byteArray = new Uint8Array(byteNumbers)
			byteArrays.push(byteArray)
		}

		const blob = new Blob(byteArrays, { type: contentType })
		return blob
	}

	//découpe les données du file en [contentType, base64data]
	let base = reader ? donnee.split(',') : donnee
	let contentType = base[0].replace('data:', '').replace(';base64', '')
	let b64Data = base[1]

	//creer le blob et trouve l'url
	let blob = b64toBlob(b64Data, contentType)
	let blobUrl = URL.createObjectURL(blob)

	return reader ? [base, blobUrl] : blobUrl
}

function b64toBlobUrl(a, b = '', c = 512) {
	const d = atob(a),
		e = []
	for (let f = 0; f < d.length; f += c) {
		const a = d.slice(f, f + c),
			b = Array(a.length)
		for (let c = 0; c < a.length; c++) b[c] = a.charCodeAt(c)
		const g = new Uint8Array(b)
		e.push(g)
	}
	const f = new Blob(e, {
			type: b,
		}),
		g = URL.createObjectURL(f)
	return g
}

function changeImgIndex(i) {
	domimg.setAttribute('index', i)
}

function renderImage(file, is) {
	let reader = new FileReader()
	reader.onload = function (event) {
		let result = event.target.result

		if (is === 'change') {
			fullImage.push(result)
			chrome.storage.local.set({ custom: fullImage })

			compress(result, 'thumbnail')
			compress(result, 'new')
		}
	}

	reader.readAsDataURL(file)
}

function compress(e, state) {
	//prend l'image complete en arg

	const img = new Image()

	img.onload = () => {
		//const size = document.getElementById('range').value;
		const elem = document.createElement('canvas')
		const ctx = elem.getContext('2d')

		//canvas proportionné à l'image

		//rétréci suivant le taux de compression
		//si thumbnail, toujours 100px
		const height = state === 'thumbnail' ? 100 : img.height * 1 //parseFloat(size));
		const scaleFactor = height / img.height
		elem.width = img.width * scaleFactor
		elem.height = height

		//dessine l'image proportionné
		ctx.drawImage(img, 0, 0, img.width * scaleFactor, height)

		//renvoie le base64
		const data = ctx.canvas.toDataURL(img)
		const cleanData = data.slice(data.indexOf(',') + 1, data.length) //used for blob

		if (state === 'thumbnail') {
			//controle les thumbnails
			addThumbnails(cleanData, fullImage.length - 1)

			fullThumbnails.push(cleanData)
			chrome.storage.local.set({ customThumbnails: fullThumbnails })
		} else {
			//new image loaded from filereader sets image index
			if (state === 'new') {
				changeImgIndex(fullImage.length - 1)
				//save l'index
				chrome.storage.local.set({ customIndex: fullImage.length - 1 })
			}

			//affiche l'image
			imgBackground(b64toBlobUrl(cleanData))
		}
	}

	img.src = e
}

function addThumbnails(data, index) {
	//créer une tag html en plus + remove button

	const div = document.createElement('div')
	const i = document.createElement('img')
	const rem = document.createElement('button')
	const wrap = document.getElementById('bg_tn_wrap')
	const upload = document.getElementById('i_bgfile')

	div.setAttribute('index', index)
	div.setAttribute('class', 'thumbnail')
	rem.setAttribute('class', 'hidden')
	rem.innerText = '✕'
	i.src = b64toBlobUrl(data)

	div.appendChild(i)
	div.appendChild(rem)
	wrap.append(div) //, wrap.children[0]);

	//events
	const getParentIndex = (that) => parseInt(that.parentElement.getAttribute('index'))
	const getIndex = (that) => parseInt(that.getAttribute('index'))
	const removeControl = (show, i) => domthumbnail[i].children[1].setAttribute('class', show ? 'shown' : 'hidden')

	//displays / hides remove button
	div.onmouseenter = function () {
		removeControl(true, getIndex(this))
	}
	div.onmouseleave = function () {
		removeControl(false, getIndex(this))
	}

	//6
	i.onmouseup = function () {
		//affiche l'image voulu
		//lui injecte le bon index

		const index = getParentIndex(this)

		compress(fullImage[index])
		changeImgIndex(index)
		chrome.storage.local.set({ customIndex: index })
	}

	//7
	rem.onmouseup = function () {
		const index = getParentIndex(this)
		let currentIndex = parseInt(id('background').getAttribute('index'))

		//removes thumbnail
		domthumbnail[index].remove()

		//rewrite all thumbs indexes
		for (let i = 0; i < domthumbnail.length; i++) {
			domthumbnail[i].setAttribute('index', i)
		}

		//deletes thumbnail from storage
		//concat  [0, index] à [index + 1, fin]
		const deleteArrItem = (arr) => arr.slice(null, index).concat(arr.slice(index + 1))

		fullImage = deleteArrItem(fullImage)
		chrome.storage.local.set({ custom: fullImage })

		fullThumbnails = deleteArrItem(fullThumbnails)
		chrome.storage.local.set({ customThumbnails: fullThumbnails })

		//celui a suppr plus petit que l'actuel, baisse son index
		if (index <= currentIndex) chrome.storage.local.set({ customIndex: currentIndex - 1 })
	}
}

function unsplash(data, event, startup) {
	//on startup nothing is displayed
	const loadbackground = (url) => (startup ? noDisplayImgLoad(url) : imgBackground(url))

	function noDisplayImgLoad(val, callback) {
		let img = new Image()

		img.onload = callback
		img.src = val
		img.remove()
	}

	function freqControl(state, every, last) {
		const d = new Date()
		if (state === 'set') return every === 'tabs' ? 0 : d.getTime()

		if (state === 'get') {
			let calcLast = 0
			let today = d.getTime()

			if (every === 'hour') calcLast = last + 3600 * 1000
			else if (every === 'day') calcLast = last + 86400 * 1000
			else if (every === 'pause') calcLast = 10 ** 13 - 1 //le jour de la fin du monde lmao

			//retourne le today superieur au calculated last
			return today > calcLast
		}
	}

	function cacheControl(dynamic, weather) {
		//as t on besoin d'une nouvelle image ?
		let needNewImage = freqControl('get', dynamic.every, dynamic.time)
		if (needNewImage) {
			//sauvegarde le nouveau temps
			dynamic.time = freqControl('set', dynamic.every)

			//si next n'existe pas, init
			if (dynamic.next.url === '') {
				req('current', dynamic, weather, true)

				//sinon prendre l'image preloaded (next)
			} else {
				loadbackground(dynamic.next.url)
				credit(dynamic.next)
				req('current', dynamic, weather, false)
			}

			//pas besoin d'image, simplement current
		} else {
			loadbackground(dynamic.current.url)
			credit(dynamic.current)
		}
	}

	function req(which, dynamic, weather, init) {
		function chooseCollection() {
			// If collection isnt ''
			if (dynamic.collection) {
				if (dynamic.collection.length > 0) {
					return dynamic.collection
				}
			}

			// Transition day and night with noon & evening collections
			// if clock is + /- 60 min around sunrise/set
			if (weather) {
				const minutator = (date) => date.getHours() * 60 + date.getMinutes()

				const { sunset, sunrise } = weather.lastState.sys,
					minsunrise = minutator(new Date(sunrise * 1000)),
					minsunset = minutator(new Date(sunset * 1000)),
					sunnow = minutator(new Date())

				if (sunnow >= 0 && sunnow <= minsunrise - 60) return collections.night
				else if (sunnow <= minsunrise + 60) return collections.noon
				else if (sunnow <= minsunset - 60) return collections.day
				else if (sunnow <= minsunset + 60) return collections.evening
				else if (sunnow >= minsunset + 60) return collections.night
				else return collections.day
			} else return collections.day
		}

		const obf = (n) =>
			n === 0
				? atob('aHR0cHM6Ly9hcGkudW5zcGxhc2guY29tL3Bob3Rvcy9yYW5kb20/Y29sbGVjdGlvbnM9')
				: atob('MzY4NmMxMjIyMWQyOWNhOGY3OTQ3Yzk0NTQyMDI1ZDc2MGE4ZTBkNDkwMDdlYzcwZmEyYzRiOWY5ZDM3N2IxZA==')
		let xhr = new XMLHttpRequest()
		xhr.open('GET', obf(0) + chooseCollection(), true)
		xhr.setRequestHeader('Authorization', `Client-ID ${obf(1)}`)

		xhr.onload = function () {
			let resp = JSON.parse(this.response)

			if (xhr.status >= 200 && xhr.status < 400) {
				let screenWidth = window.devicePixelRatio * screen.width

				resp = {
					url: resp.urls.raw + `&w=${screenWidth}&fm=jpg&q=70`,
					link: resp.links.html,
					username: resp.user.username,
					name: resp.user.name,
					city: resp.location.city,
					country: resp.location.country,
				}

				if (init) {
					//si init, fait 2 req (current, next) et save sur la 2e
					if (which === 'current') {
						dynamic.current = resp
						loadbackground(dynamic.current.url)
						credit(dynamic.current)
						req('next', dynamic, weather, true)
					} else if (which === 'next') {
						dynamic.next = resp
						chrome.storage.sync.set({ dynamic: dynamic })
					}

					//si next existe, current devient next et next devient la requete
					//preload la prochaine image (sans l'afficher)
				} else {
					noDisplayImgLoad(resp.url, () => {
						dynamic.current = dynamic.next
						dynamic.next = resp
						chrome.storage.sync.set({ dynamic: dynamic })
					})
				}
			}
		}
		xhr.send()
	}

	function credit(d) {
		let loc = ''

		if (d.city !== null && d.country !== null) loc = `${d.city}, ${d.country} - `
		else if (d.country !== null) loc = `${d.country} - `
		else loc = 'Photo - '

		let infos = {
			location: {
				text: loc,
				url: `${d.link}?utm_source=Bonjourr&utm_medium=referral`,
			},
			artist: {
				text: d.name,
				url: `https://unsplash.com/@${d.username}?utm_source=Bonjourr&utm_medium=referral`,
			},
		}

		if (!startup) imgCredits(infos, 'dynamic')
	}

	function actionFromStorage() {
		chrome.storage.sync.get(['dynamic', 'weather'], (storage) => {
			//
			// Dynamic events: freq & collection
			if (typeof event === 'object') {
				if (event.every !== undefined) {
					storage.dynamic.every = event.every
				} else if (event.collection !== undefined) {
					// Removes next image from old collection data
					storage.dynamic.current = initDynamic.current
					storage.dynamic.next = initDynamic.next
					storage.dynamic.time = initDynamic.time
					storage.dynamic.collection = event.collection
				}

				chrome.storage.sync.set({ dynamic: storage.dynamic })
			}

			// No events, just look in storage or init
			if (storage && storage.dynamic !== undefined) cacheControl(storage.dynamic, storage.weather)
			else cacheControl(initDynamic)
		})
	}

	const initDynamic = {
		current: {
			url: '',
			link: '',
			username: '',
			name: '',
			city: '',
			country: '',
		},
		next: {
			url: '',
			link: '',
			username: '',
			name: '',
			city: '',
			country: '',
		},
		collection: '',
		every: 'hour',
		time: 0,
	}

	// No passed data, search in storage or init
	if (data === null || data === undefined) actionFromStorage()
	else {
		// Data & dynamic exist
		if (data.dynamic !== undefined) cacheControl(data.dynamic, data.weather)
		else actionFromStorage()
	}
}

function filter(cat, val) {
	let result = ''

	switch (cat) {
		case 'init':
			result = `blur(${val[0]}px) brightness(${val[1]})`
			break

		case 'blur':
			result = `blur(${val}px) brightness(${id('i_bright').value})`
			break

		case 'bright':
			result = `blur(${id('i_blur').value}px) brightness(${val})`
			break
	}

	id('background').style.filter = result
}

function darkmode(choice, initStorage) {
	function apply(state) {
		function auto(weather) {
			if (weather === undefined) {
				return 'autodark'
			}

			//compare current hour with weather sunset / sunrise
			const ls = weather.lastState
			const sunrise = new Date(ls.sys.sunrise * 1000).getHours()
			const sunset = new Date(ls.sys.sunset * 1000).getHours()
			const hr = new Date().getHours()

			return hr < sunrise || hr > sunset ? 'dark' : ''
		}

		//uses chromesync data on startup, sessionsStorage on change
		const weather = initStorage ? initStorage.weather : JSON.parse(localEnc(disposableData, false)).weather
		let bodyClass

		//dark mode is defines by the body class

		switch (state) {
			case 'system':
				bodyClass = 'autodark'
				break

			case 'auto':
				bodyClass = auto(weather)
				break

			case 'enable':
				bodyClass = 'dark'
				break

			default:
				bodyClass = 'autodark'
		}

		document.body.setAttribute('class', bodyClass)
	}

	//apply class, save if event
	if (choice) {
		apply(choice, true)
		chrome.storage.sync.set({ dark: choice })
	} else {
		apply(initStorage.dark)
	}
}

function searchbar(event, that, storage) {
	function display(value, init) {
		id('sb_container').setAttribute('class', value ? 'shown' : 'hidden')

		if (!init) {
			chrome.storage.sync.set({ searchbar: value })
			id('choose_searchengine').setAttribute('class', value ? 'shown' : 'hidden')
		}
	}

	function localisation(q) {
		let response = '',
			lang = storage ? storage.lang || 'en' : 'en',
			engine = sessionStorage.engine

		// engineLocales est dans lang.js
		response = engineLocales[engine].base.replace('$locale$', engineLocales[engine][lang]).replace('$query$', q)

		return response
	}

	function engine(value, init) {
		const names = {
			startpage: 'Startpage',
			ddg: 'DuckDuckGo',
			qwant: 'Qwant',
			lilo: 'Lilo',
			ecosia: 'Ecosia',
			google: 'Google',
			yahoo: 'Yahoo',
			bing: 'Bing',
		}

		id('searchbar').setAttribute('placeholder', tradThis('Search on ' + names[value]))
		if (!init) chrome.storage.sync.set({ searchbar_engine: value })
		sessionStorage.engine = value
	}

	function setNewtab(value, init) {
		if (!init) chrome.storage.sync.set({ searchbar_newtab: value })
		sessionStorage.newtab = value
	}

	id('searchbar').onkeyup = function (e) {
		if (e.which === 13) {
			if (sessionStorage.newtab === 'true') window.open(localisation(this.value), '_blank')
			else window.location = localisation(this.value)
		}
	}

	if (event) {
		if (event === 'searchbar') display(that.checked)
		if (event === 'engine') engine(that.value)
		if (event === 'newtab') setNewtab(that.checked)
	}
	//init
	else {
		const searchbar = storage.searchbar || false,
			searchengine = storage.searchbar_engine || 'google',
			searchbarnewtab = storage.searchbar_newtab || false

		//display
		display(searchbar, true)
		engine(searchengine.replace('s_', ''), true)
		setNewtab(searchbarnewtab, true)

		// 1.9.2 ==> 1.9.3 lang breaking fix
		if (storage.searchbar_engine) {
			chrome.storage.sync.set({ searchbar_engine: searchengine.replace('s_', '') })
		}
	}
}

function showPopup(data) {
	const popup = id('popup')
	const closePopup = id('closePopup')
	const go = id('go')

	go.setAttribute(
		'href',
		navigator.userAgent.includes('Chrome')
			? 'https://chrome.google.com/webstore/detail/bonjourr-%C2%B7-minimalist-lig/dlnejlppicbjfcfcedcflplfjajinajd/reviews'
			: 'https://addons.mozilla.org/en-US/firefox/addon/bonjourr-startpage/'
	)

	//s'affiche après 10 tabs
	if (data > 10) {
		const close = function () {
			popup.classList.add('removed')
			chrome.storage.sync.set({ reviewPopup: 'removed' })
		}

		//attendre avant d'afficher
		setTimeout(function () {
			popup.classList.add('shown')
		}, 2000)

		closePopup.onclick = close
		go.onclick = close
	} else if (typeof data === 'number') chrome.storage.sync.set({ reviewPopup: data + 1 })
	else if (data !== 'removed') chrome.storage.sync.set({ reviewPopup: 0 })
	else if (data === 'removed') document.body.removeChild(popup)
}

function proFunctions(obj) {
	function customFont(data, event) {
		function setFont(f, is) {
			function saveFont(cssURL, supportedWeights) {
				const font = {
					supportedWeights: supportedWeights || ['400'],
					family: id('i_customfont').value,
					weight: id('i_weight').value,
					size: id('i_size').value,
					url: cssURL || f.url,
				}

				chrome.storage.sync.set({ font: font })
			}

			function applyFont(URL) {
				//
				//
				function applyWeightAndSize() {
					if (f.weight) id('interface').style.fontWeight = f.weight
					if (f.size) dominterface.style.fontSize = f.size + 'px'
				}

				const url = f.url || URL
				if (url) {
					fetch(url)
						.then((response) => response.text())
						.then((text) => {
							text = text.replace(/(\r\n|\n|\r|  )/gm, '')
							id('fontstyle').innerText = text ? text : f.str

							if (f.family) {
								document.body.style.fontFamily = f.family
								id('clock').style.fontFamily = f.family
							}

							applyWeightAndSize()
						})
				} else {
					applyWeightAndSize()
				}
			}

			function removeFont() {
				id('fontstyle').innerText = ''
				document.body.style.fontFamily = ''
				id('clock').style.fontFamily = ''
			}

			//si on change la famille
			if (is === 'event' && (f.family !== null || f.weight !== null)) {
				const dom = id('i_customfont')
				const userFamily = dom.value
				const userWeight = f.weight === '400' ? 'regular' : f.weight || 'regular'

				if (userFamily === '') {
					saveFont()
					removeFont()
					return false
				}

				// Liste toute les fonts
				fetch('https://www.googleapis.com/webfonts/v1/webfonts?key=AIzaSyAky3JYc2rCOL1jIssGBgLr1PT4yW15jOk')
					.then((response) => response.json())
					.then((json) => {
						//
						// Cherche correspondante
						const font = json.items.filter((font) => font.family.toUpperCase() === userFamily.toUpperCase())

						if (font.length > 0) {
							//
							// Envoie l'URL a apply et save
							const url = `https://fonts.googleapis.com/css?family=${font[0].family}:${userWeight}`

							// To prevent weight sliders from sending useless requests
							const availableWeight = font[0].variants.filter((vari) => !vari.includes('italic'))

							if (availableWeight.indexOf(userWeight) > -1) {
								applyFont(url)
								saveFont(url, availableWeight)

								dom.blur()
								dom.setAttribute('placeholder', 'Any Google fonts')
							} else {
								saveFont(null, availableWeight)
							}
						} else {
							dom.value = ''
							dom.setAttribute('placeholder', 'No fonts matched')
						}
					})
			} else if (is === 'event') {
				//si on change autre chose que la famille
				saveFont()
				applyFont()

				//si ça n'est pas un event
			} else applyFont()
		}

		//init
		if (data) setFont(data)
		if (event) setFont(event, 'event')
	}

	function customCss(data, event) {
		const styleHead = id('styles')

		// Active l'indentation
		function syntaxControl(e, that) {
			const cursorPosStart = that.selectionStart,
				beforeCursor = that.value.slice(0, cursorPosStart),
				afterCursor = that.value.slice(cursorPosStart + 1, that.value.length - 1)

			if (e.key === '{') {
				that.value = beforeCursor + `{\r  \r}` + afterCursor
				that.selectionStart = cursorPosStart + 3
				that.selectionEnd = cursorPosStart + 3
				e.preventDefault()
			}
		}

		if (data) {
			styleHead.innerText = data
		}

		if (event) {
			//const e = event.e
			// const that = event.that
			// syntaxControl(e, that)

			const val = id('cssEditor').value
			styleHead.innerText = val
			slowRange({ css: val }, 500)
		}
	}

	function linksrow(data, event) {
		function setRows(val) {
			domlinkblocks.style.width = `${val * 7}em`
		}

		if (data !== undefined) setRows(data)

		if (event) {
			//id("e_row").innerText = event;
			setRows(event)
			slowRange({ linksrow: parseInt(event) })
		}
	}

	function greeting(data, event) {
		let text = id('greetings').innerText
		let pause

		function apply(val) {
			//greeting is classic text + , + custom greet
			id('greetings').innerText = `${text}, ${val}`

			//input empty removes ,
			if (val === '') id('greetings').innerText = text
		}

		function setEvent(val) {
			const virgule = text.indexOf(',')

			//remove last input from greetings
			text = text.slice(0, virgule === -1 ? text.length : virgule)
			apply(val)

			//reset save timeout
			//wait long enough to save to storage
			if (pause) clearTimeout(pause)

			pause = setTimeout(function () {
				chrome.storage.sync.set({ greeting: val })
			}, 1200)
		}

		//init
		if (data !== undefined) apply(data)
		if (event !== undefined) setEvent(event)
	}

	function hideElem(init, buttons, that) {
		const IDsList = [
			['time', ['time-container', 'date']],
			['main', ['greetings', 'weather_desc', 'w_icon']],
			['linkblocks', ['linkblocks']],
			['showSettings', ['showSettings']],
		]

		// Returns { row, col } to naviguate [[0, 0], [0, 0, 0]] etc.
		function getEventListPosition(that) {
			return { row: parseInt(that.getAttribute('he_row')), col: parseInt(that.getAttribute('he_col')) }
		}

		function toggleElement(dom, hide) {
			if (hide) id(dom).classList.add('he_off')
			else id(dom).classList.remove('he_off')
		}

		function isEverythingHidden(list, row) {
			const filtered = list[row].filter((el) => el === 1)
			return filtered.length === list[row].length
		}

		function initializeHiddenElements(list) {
			list.forEach((row, row_i) => {
				//
				// Hide parents
				if (isEverythingHidden(list, row_i)) {
					toggleElement(IDsList[row_i][0], true)
				}

				//
				// Hide children
				row.forEach((child, child_i) => {
					if (child === 1) toggleElement(IDsList[row_i][1][child_i], true)
				})
			})
		}

		function updateToNewData(list) {
			if (list[0]) {
				if (typeof list[0][0] === 'string') {
					//
					// Flattens and removes parent IDs
					const childOnly = IDsList.flat().filter((row) => typeof row === 'object')
					let newHidden = [[0, 0], [0, 0, 0], [0], [0]]

					//
					// Go through IDs list for every old hide elems
					list.forEach((id) => {
						childOnly.forEach((row, row_i) =>
							row.forEach((col, col_i) => {
								if (col === id) {
									newHidden[row_i][col_i] = 1
								}
							})
						)
					})

					chrome.storage.sync.set({ hide: newHidden })
					return newHidden
				}

				// Is already updated
				else return list
			}

			// Had nothing to hide
			else return list
		}

		// startup initialization
		if (that === undefined && buttons === undefined) {
			//
			// first startup
			if (!init) {
				chrome.storage.sync.set({ hide: [[0, 0], [0, 0, 0], [0], [0]] })
				return false
			}

			initializeHiddenElements(updateToNewData(init))
		}

		// Settings buttons initialization
		else if (buttons !== undefined) {
			chrome.storage.sync.get('hide', (data) => {
				//
				// 1.9.3 ==> 1.10.0
				data.hide = updateToNewData(data.hide)

				buttons.forEach((button) => {
					const pos = getEventListPosition(button)
					if (data.hide[pos.row][pos.col] === 1) button.classList.toggle('clicked')
				})
			})
		}

		// Event
		else {
			chrome.storage.sync.get('hide', (data) => {
				//
				// 1.9.3 ==> 1.10.0
				data.hide = updateToNewData(data.hide)

				const pos = getEventListPosition(that)
				const state = that.classList.contains('clicked')
				const child = IDsList[pos.row][1][pos.col]
				const parent = IDsList[pos.row][0]

				// Update hidden list
				data.hide[pos.row][pos.col] = state ? 1 : 0
				chrome.storage.sync.set({ hide: data.hide })

				// Toggle children and parent if needed
				toggleElement(child, state)
				toggleElement(parent, isEverythingHidden(data.hide, pos.row))
			})
		}
	}

	switch (obj.which) {
		case 'font':
			customFont(obj.data, obj.event)
			break

		case 'css':
			customCss(obj.data, obj.event)
			break

		case 'row':
			linksrow(obj.data, obj.event)
			break

		case 'greet':
			greeting(obj.data, obj.event)
			break

		case 'hide':
			hideElem(obj.data, obj.buttons, obj.event)
			break
	}
}

window.onload = function () {
	chrome.storage.sync.get(null, (data) => {
		//1.8.3 -> 1.9 data transfer
		if (localStorage.lang) {
			data.lang = localStorage.lang
			chrome.storage.sync.set({ lang: localStorage.lang })
			localStorage.removeItem('lang')
		}

		//pour que les settings y accede plus facilement
		disposableData = localEnc(JSON.stringify(data))

		traduction(null, data.lang)
		greetings()
		date(null, data.usdate)
		newClock(null, data.clock)
		darkmode(null, data)
		initBackground(data)
		weather(null, null, data)
		quickLinks(null, null, data)
		searchbar(null, null, data)
		showPopup(data.reviewPopup)

		//init profunctions
		proFunctions({ which: 'hide', data: data.hide })
		proFunctions({ which: 'font', data: data.font })
		proFunctions({ which: 'css', data: data.css })
		proFunctions({ which: 'row', data: data.linksrow })
		proFunctions({ which: 'greet', data: data.greeting })

		// New way to show interface
		dominterface.style.opacity = '1'
		domshowsettings.style.opacity = '1'

		// Old compatibility
		clas(dominterface, '')
		clas(domshowsettings, '')

		//safe font for different alphabet
		if (data.lang === 'ru' || data.lang === 'sk') {
			const safeFont = () =>
				(id('styles').innerText = `
			body, #settings, #settings h5 {font-family: Helvetica, Calibri}`)

			if (!data.font) safeFont()
			else if (data.font.family === '') safeFont()
		}

		if (mobilecheck) {
			dominterface.style.minHeight = '90vh'
			dominterface.style.padding = '0 0 10vh 0'
		}
	})
}
