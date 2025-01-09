require('pebblejs');
var Settings = require('pebblejs/settings');
var UI = require('pebblejs/ui');
var Vibe = require('pebblejs/ui/vibe');
var ajax = require('pebblejs/lib/ajax');
var Feature = require('pebblejs/platform/feature');

var loadingScreen = new UI.Card({
    status: {
        backgroundColor: Feature.color(0x00AAFF, 'white'),
        separator: 'none'
    },
    title: 'Loading...',
});

var errorScreen = new UI.Card({
    status: {
        backgroundColor: Feature.color(0x00AAFF, 'white'),
        separator: 'none'
    },
    title: 'Error!'
});

var packagesMenu = new UI.Menu({
    status: {
        backgroundColor: Feature.color(0x00AAFF, 'white'),
        separator: 'none'
    }, 
    highlightBackgroundColor: Feature.color(0x00AAFF, 'black'),
    highlightTextColor: Feature.color('black', 'white'),
    sections: [{ title: 'Packages', items: [] }]
});

var packageInfo = new UI.Menu({
    status: {
        backgroundColor: Feature.color(0x00AAFF, 'white'),
        separator: 'none'
    }, 
    highlightBackgroundColor: Feature.color(0x00AAFF, 'black'),
    highlightTextColor: Feature.color('black', 'white'),
    sections: [{ title: 'Shipment Info', items: [] }, { title: 'Shipment Progress', items: [] }]
});

var packageInfoCard = new UI.Card({
    status: {
        backgroundColor: Feature.color(0x00AAFF, 'white'),
        separator: 'none'
    }, 
    title: 'Shipment',
    highlightBackgroundColor: Feature.color(0x00AAFF, 'black'),
    highlightTextColor: Feature.color('black', 'white'),
    scrollable: true
});

function showError(msg) {
    errorScreen.body(msg);
    errorScreen.show();
}

function updatePackagesMenu(packages) {
    var menuItems = [];

    for (var i = 0; i < packages.length; i++) {
        var package = packages[i];

        menuItems.push({
            title: package.itemName,
            subtitle: package.trackingNumber
        });
    }

    packagesMenu.items(0, menuItems.length ? menuItems : [{ title: 'No packages', subtitle: 'Add packages via settings' }]); // if no items display message
}

var packages = Settings.data('packages') || [];
updatePackagesMenu(packages);
packagesMenu.show();

packageInfo.on('select', function(e) {
    if (e.section.title !== 'Shipment Progress') return;

    packageInfoCard.body(e.item.title);
    packageInfoCard.show();
});

packagesMenu.on('select', function(e) {
    if (e.item.title === 'No packages') return;

    loadingScreen.show();

    var trackingId = e.item.subtitle;

// Replace 'your_secret_key' with your actual 17TRACK API key
const apiKey = '0ED3A7A89C413E7962A5856AC1E725A1';

fetch('https://api.17track.net/track/v2.2/gettrackinfo' + trackingID, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        '17token': apiKey
    },
    body: JSON.stringify([{ number: trackingId }])
})
.then(response => response.json())
.then(data => {
    loadingScreen.hide();

    const packageProgressMarks = data[0].data.map(event => {
        const eventTime = event.a.split('T');
        const date = eventTime[0].split('-');
        const time = eventTime[1].split(':');
        const hour = parseInt(time[0]);
        
        return {
            title: event.z,
            subtitle: `At: ${date[1]}/${date[2]}, ${hour >= 12 ? hour - 12 : hour}:${time[1]} ${hour >= 12 ? 'PM' : 'AM'}`
        };
    });

    const meta = [{ title: 'Status:', subtitle: data[0].status }];
    if (data[0].daysInTransit) {
        meta.push({ title: 'Days in Transit:', subtitle: data[0].daysInTransit });
    }
    if (data[0].minRemaining) {
        meta.push({
            title: 'ETA:',
            subtitle: `${data[0].minRemaining}-${data[0].maxRemaining} Days`
        });
    }

    packageInfo.items(0, meta);
    packageInfo.items(1, packageProgressMarks);
    packageInfo.show();
})
.catch(err => {
    loadingScreen.hide();
    Vibe.vibrate('double');
    
    if (err.error) {
        showError(err.error);
    } else {
        console.error(err);
        showError('Something went wrong. Try checking your network connection.');
    }
});

Pebble.addEventListener('showConfiguration', function() {
    var data = Settings.data('packages') || [];
    var timelinePinsEnabled = Settings.option('timelinePinsEnabled');

    Pebble.openURL(
        'https://oonqt.github.io/pebble-deliveries/config?data=' +
        encodeURIComponent(
            JSON.stringify({
                packages: data,
                timelinePinsEnabled: timelinePinsEnabled,
            })
        )
	);
});

Pebble.addEventListener('webviewclosed', function(e) {
    if (!e.data) return;

    const data = JSON.parse(e.data);
    Settings.data('packages', data.packages);
    Settings.option('enableTimelinePins', data.enableTimelinePins);
    updatePackagesMenu(data.packages);
});
