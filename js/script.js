
(function () {
  'use strict';

  // 1. الإعدادات
  var CFG = window.FRESH_CONFIG || {};

  var API = CFG.API_BASE || '';
  API = API.replace(/\/+$/, '');

  var WA = CFG.WA_NUMBER;

  // 2. البيانات والسلة
  var PRODUCTS = [];
  var cart = {};

  try {
    cart = JSON.parse(localStorage.getItem('fresh_cart') || '{}');
  } catch (e) {
    cart = {};
  }

  // 3. دوال مساعدة
  function $(selector) {
    return document.querySelector(selector);
  }

  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (char) {
      var entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };

      return entities[char];
    });
  }

  function saveCart() {
    try {
      localStorage.setItem('fresh_cart', JSON.stringify(cart));
    } catch (e) {
      // قد يكون التخزين غير متاح
    }
  }

  function waLink(message) {
    return 'https://wa.me/' + WA + '?text=' +
      encodeURIComponent(message);
  }

  function findProduct(id) {
    var i;

    for (i = 0; i < PRODUCTS.length; i++) {
      if (String(PRODUCTS[i].id) === String(id)) {
        return PRODUCTS[i];
      }
    }

    return null;
  }

  function isWithinAvailability(product) {
    var today = new Date();
    var localDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');

    return (!product.available_from || localDate >= product.available_from) &&
      (!product.available_until || localDate <= product.available_until);
  }

  function canOrder(product) {
    return product.available && (product.is_preorder || isWithinAvailability(product));
  }

  function toast(message) {
    var t = document.createElement('div');

    t.className = 'toast';
    t.textContent = message;

    document.body.appendChild(t);

    setTimeout(function () {
      t.remove();
    }, 1800);
  }

  // 4. عرض المنتجات
  var grid = $('#productGrid');

  function renderProducts() {
    if (PRODUCTS.length === 0) {
      grid.innerHTML =
        '<p class="empty">لا توجد منتجات متاحة حاليًا.</p>';
      return;
    }

    var html = '';
    var i;
    var p;
    var media;
    var button;

    for (i = 0; i < PRODUCTS.length; i++) {
      p = PRODUCTS[i];

      // صورة المنتج
      if (p.image_url) {
        media =
          '<img src="' + esc(p.image_url) +
          '" alt="' + esc(p.name) +
          '" loading="lazy" data-fallback="1">';
      } else {
        media =
          '<div class="product__ph">' +
          '<i class="fa-solid fa-drumstick-bite"></i>' +
          '</div>';
      }

      // زر الإضافة
      if (canOrder(p)) {
        button =
          '<button class="add" data-id="' + esc(p.id) + '">' +
          '<i class="fa-solid fa-plus"></i> ' +
          (p.is_preorder ? 'اطلب مسبقًا' : 'أضف') +
          '</button>';
      } else {
        button = '<span class="soldout">غير متاح حاليًا</span>';
      }

      var productDetails = [];
      if (p.is_preorder) {
        productDetails.push('<span class="product__badge">طلب مسبق</span>');
      }
      if (p.available_from || p.available_until) {
        productDetails.push(
          '<small class="product__dates">فترة التوفر: ' +
          esc(p.available_from || 'غير محدد') + ' - ' +
          esc(p.available_until || 'غير محدد') + '</small>'
        );
      }

      html +=
        '<article class="product">' +

        '<div class="product__media">' +
        media +
        '<span class="product__weight">' +
        esc(p.weight) +
        '</span>' +
        '</div>' +

        '<div class="product__body">' +
        '<h3>' + esc(p.name) + '</h3>' +
        productDetails.join(' ') +

        '<div class="product__foot">' +
        '<div class="price">' +
        Number(p.price) +
        '<small>جنيه</small>' +
        '</div>' +
        button +
        '</div>' +
        '</div>' +

        '</article>';
    }

    grid.innerHTML = html;

    // التعامل مع الصور التي لا تعمل
    var images = grid.querySelectorAll('img[data-fallback]');

    for (i = 0; i < images.length; i++) {
      images[i].addEventListener('error', function () {
        var placeholder = document.createElement('div');

        placeholder.className = 'product__ph';

        placeholder.innerHTML =
          '<i class="fa-solid fa-drumstick-bite"></i>';

        this.replaceWith(placeholder);
      });
    }
  }

  // 5. تحميل المنتجات من API
  function loadProducts() {
    fetch(API + '/api/products')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('فشل تحميل المنتجات');
        }

        return response.json();
      })
      .then(function (data) {
        PRODUCTS = data;

        renderProducts();
        renderCart();
      })
      .catch(function () {
        grid.innerHTML =
          '<p class="empty">' +
          'تعذر تحميل المنتجات، حاول تاني بعد شوية.' +
          '</p>';
      });
  }

  // 6. إضافة منتج إلى السلة
  grid.addEventListener('click', function (event) {
    var button = event.target.closest('.add');

    if (!button) {
      return;
    }

    var id = button.dataset.id;
    var product = findProduct(id);
    if (!product || !canOrder(product)) {
      toast('المنتج غير متاح للطلب حاليًا');
      renderProducts();
      return;
    }

    if (cart[id]) {
      cart[id] = cart[id] + 1;
    } else {
      cart[id] = 1;
    }

    saveCart();
    renderCart();

    button.classList.add('done');

    button.innerHTML =
      '<i class="fa-solid fa-check"></i> تمت الإضافة';

    setTimeout(function () {
      button.classList.remove('done');

      button.innerHTML =
        '<i class="fa-solid fa-plus"></i> أضف';
    }, 1200);
  });

  // 7. عرض السلة وحساب الإجمالي
  var body = $('#cartBody');
  var foot = $('#cartFoot');

  function renderCart() {
    var ids = Object.keys(cart);
    var count = 0;
    var total = 0;
    var html = '';
    var i;
    var id;
    var product;
    var quantity;
    var validCount = 0;

    for (i = 0; i < ids.length; i++) {
      id = ids[i];

      if (cart[id] > 0 && findProduct(id)) {
        validCount++;
      }
    }

    if (validCount === 0) {
      body.innerHTML =
        '<div class="empty">' +
        '<i class="fa-solid fa-basket-shopping"></i>' +
        '<p>السلة فارغة. أضف منتجاتك من القائمة.</p>' +
        '</div>';

      foot.style.display = 'none';
      $('#cartCount').textContent = '0';
      $('#cartTotal').textContent = '0 جنيه';

      return;
    }

    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      product = findProduct(id);
      quantity = cart[id];

      if (!product || quantity <= 0 || !canOrder(product)) {
        continue;
      }

      count = count + quantity;
      total = total + quantity * Number(product.price);

      html +=
        '<div class="line">' +

        '<div>' +
        '<b>' + esc(product.name) + '</b>' +
        '<small>' + esc(product.weight) + '</small>' +
        '</div>' +

        '<div class="line__price">' +
        (quantity * Number(product.price)) +
        ' جنيه' +
        '</div>' +

        '<div class="qty">' +
        '<button data-act="inc" data-id="' + esc(id) +
        '" aria-label="زيادة">' +
        '<i class="fa-solid fa-plus"></i>' +
        '</button>' +

        '<span>' + quantity + '</span>' +

        '<button data-act="dec" data-id="' + esc(id) +
        '" aria-label="تقليل">' +
        '<i class="fa-solid fa-minus"></i>' +
        '</button>' +
        '</div>' +

        '<button class="remove" data-act="del" data-id="' +
        esc(id) + '" aria-label="حذف">' +
        '<i class="fa-solid fa-trash"></i>' +
        '</button>' +

        '</div>';
    }

    body.innerHTML = html;
    foot.style.display = 'grid';

    $('#cartCount').textContent = count;
    $('#cartTotal').textContent = total + ' جنيه';
  }

  // 8. زيادة الكمية أو تقليلها أو حذف المنتج
  body.addEventListener('click', function (event) {
    var button = event.target.closest('[data-act]');

    if (!button) {
      return;
    }

    var id = button.dataset.id;
    var action = button.dataset.act;

    if (action === 'inc') {
      cart[id] = (cart[id] || 0) + 1;
    }

    if (action === 'dec') {
      cart[id] = Math.max(0, (cart[id] || 0) - 1);
    }

    if (action === 'del') {
      cart[id] = 0;
    }

    if (cart[id] <= 0) {
      delete cart[id];
    }

    saveCart();
    renderCart();
  });

  // 9. فتح وإغلاق السلة
  var drawer = $('#drawer');
  var overlay = $('#overlay');

  function openCart() {
    drawer.classList.add('open');
    overlay.classList.add('show');

    drawer.setAttribute('aria-hidden', 'false');
  }

  function closeCart() {
    drawer.classList.remove('open');
    overlay.classList.remove('show');

    drawer.setAttribute('aria-hidden', 'true');
  }

  $('#openCart').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeCart();
    }
  });

  // 10. إرسال الطلب على واتساب
  $('#sendOrder').addEventListener('click', function () {
    var name = $('#custName').value.trim();

    if (!name) {
      $('#custName').focus();
      toast('اكتب اسمك أولًا');
      return;
    }

    var ids = Object.keys(cart);
    var lines = [];
    var total = 0;
    var i;
    var id;
    var product;
    var quantity;

    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      product = findProduct(id);
      quantity = cart[id];

      if (!product || quantity <= 0) {
        continue;
      }

      var itemTotal = quantity * Number(product.price);

      total = total + itemTotal;

      lines.push(
        '- ' + product.name +
        ' (' + product.weight + ')' +
        (product.is_preorder ? ' - طلب مسبق' : '') +
        ' × ' + quantity +
        ' = ' + itemTotal + ' جنيه'
      );
    }

    if (lines.length === 0) {
      toast('السلة فارغة، أضف منتجات أولًا');
      return;
    }

    var message =
      'طلب جديد من موقع فريش\n' +
      'الاسم: ' + name + '\n' +
      $('#custBranch').value + '\n\n' +
      lines.join('\n') +
      '\n\nالإجمالي: ' + total + ' جنيه';

    window.open(waLink(message), '_blank', 'noopener');
  });

  // 11. نموذج الطلب المسبق
  $('#preorderForm').addEventListener('submit', function (event) {
    event.preventDefault();

    var form = event.target;

    var name = form.querySelector('[name="name"]').value;
    var details = form.querySelector('[name="details"]').value;

    var message =
      'طلب مسبق من موقع فريش\n' +
      'الاسم: ' + name + '\n' +
      'التفاصيل: ' + details;

    window.open(waLink(message), '_blank', 'noopener');

    form.reset();
  });

  // 12. نموذج الشكاوى والاقتراحات
  $('#feedbackForm').addEventListener('submit', function (event) {
    event.preventDefault();

    var form = event.target;

    var type = form.querySelector('[name="type"]').value;
    var name = form.querySelector('[name="name"]').value;
    var messageText = form.querySelector('[name="msg"]').value;

    var message =
      type + ' من موقع فريش\n' +
      'الاسم: ' + name + '\n' +
      'الرسالة: ' + messageText;

    window.open(waLink(message), '_blank', 'noopener');

    form.reset();
  });

  // 13. السؤال عن المنتجات الموسمية
  $('#askSeasonal').href = waLink(
    'السلام عليكم، عايز أسأل عن المتاح من السمان والبط وسعره اليوم.'
  );

  // 14. حالة المحل حسب توقيت القاهرة
  function updateStatus() {
    var hour = parseInt(
      new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Africa/Cairo'
      }).format(new Date()),
      10
    );

    var isOpen = hour >= 8 && hour < 24;

    $('#status').classList.toggle('closed', !isOpen);

    if (isOpen) {
      $('#statusText').textContent =
        'مفتوح الآن حتى 12 منتصف الليل';
    } else {
      $('#statusText').textContent =
        'مغلق الآن، نفتح 8 صباحًا';
    }
  }

  updateStatus();
  setInterval(updateStatus, 60000);

  // 15. قائمة الموبايل
  var nav = $('#nav');
  var burger = $('#burger');

  burger.addEventListener('click', function () {
    var isOpen = nav.classList.toggle('open');

    burger.setAttribute('aria-expanded', isOpen);
  });

  nav.addEventListener('click', function (event) {
    if (event.target.tagName === 'A') {
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  // 16. السنة الحالية
  $('#year').textContent = new Date().getFullYear();

  // 17. تشغيل الموقع
  renderCart();
  loadProducts();

})();
