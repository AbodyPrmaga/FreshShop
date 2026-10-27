// عنوان الـ API من config.js
var API = (window.FRESH_CONFIG.API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");
var token = sessionStorage.getItem("fresh_admin_token") || "";
var products = [];

var loginSection = document.getElementById("loginSection");
var dashboardSection = document.getElementById("dashboardSection");
var loginForm = document.getElementById("loginForm");
var loginMessage = document.getElementById("loginMessage");
var editorSection = document.getElementById("editorSection");
var productForm = document.getElementById("productForm");
var productsList = document.getElementById("productsList");
var globalMessage = document.getElementById("globalMessage");

function field(name) {
  return productForm.elements.namedItem(name);
}

function showMessage(element, message) {
  element.textContent = message;
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char];
  });
}

// إرسال الطلبات العادية إلى FastAPI
function request(url, options) {
  options = options || {};
  options.headers = options.headers || {};
  options.headers["Content-Type"] = "application/json";

  if (token) {
    options.headers["Authorization"] = "Bearer " + token;
  }

  return fetch(API + url, options).then(function (response) {
    return response.json().catch(function () {
      return {};
    }).then(function (data) {
      if (!response.ok) {
        throw new Error(data.detail || "حدث خطأ في الاتصال");
      }

      return data;
    });
  });
}

// رفع الصورة إلى FastAPI، الذي يرفعها إلى ImgBB
function uploadImage(file) {
  var formData = new FormData();
  formData.append("image", file);

  return fetch(API + "/api/admin/upload-image", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token
    },
    body: formData
  }).then(function (response) {
    return response.json().catch(function () {
      return {};
    }).then(function (data) {
      if (!response.ok) {
        throw new Error(data.detail || "فشل رفع الصورة");
      }

      return data.image_url;
    });
  });
}

function showDashboard() {
  loginSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
  document.getElementById("logoutButton").classList.remove("hidden");
  loadProducts();
}

function showLogin() {
  loginSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
  document.getElementById("logoutButton").classList.add("hidden");
}

// تسجيل الدخول
loginForm.addEventListener("submit", function (event) {
  event.preventDefault();
  showMessage(loginMessage, "جارٍ تسجيل الدخول...");

  request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({
      username: loginForm.elements.namedItem("username").value.trim(),
      password: loginForm.elements.namedItem("password").value
    })
  }).then(function (data) {
    token = data.token;
    sessionStorage.setItem("fresh_admin_token", token);
    showMessage(loginMessage, "");
    showDashboard();
  }).catch(function (error) {
    showMessage(loginMessage, error.message);
  });
});

// تحميل المنتجات
function loadProducts() {
  request("/api/products").then(function (list) {
    products = list;
    renderProducts();
  }).catch(function (error) {
    showMessage(globalMessage, error.message + " — تأكد أن FastAPI يعمل.");
  });
}

// عرض المنتجات
function renderProducts() {
  var available = products.filter(function (product) {
    return product.available;
  }).length;

  document.getElementById("totalProducts").textContent = products.length;
  document.getElementById("availableProducts").textContent = available;
  document.getElementById("unavailableProducts").textContent = products.length - available;

  if (!products.length) {
    productsList.innerHTML =
      '<div class="empty">لا توجد منتجات بعد. اضغط «منتج جديد» لإضافة أول منتج.</div>';
    return;
  }

  productsList.innerHTML = products.map(function (product) {
    var image = product.image_url
      ? '<img src="' + escapeHtml(product.image_url) + '" alt="' + escapeHtml(product.name) + '">'
      : '<div class="product-placeholder"><i class="fa-solid fa-drumstick-bite"></i></div>';

    var status = product.available
      ? '<span class="status on">متاح</span>'
      : '<span class="status off">غير متاح</span>';
    var productOptions = [];

    if (product.is_preorder) {
      productOptions.push('<span class="status on">طلب مسبق</span>');
    }
    if (product.available_from || product.available_until) {
      productOptions.push(
        '<span class="product-dates">فترة التوفر: ' +
        escapeHtml(product.available_from || "بدون بداية") + " - " +
        escapeHtml(product.available_until || "بدون نهاية") + '</span>'
      );
    }

    return '<article class="product-row">' + image +
      '<div class="product-info">' +
      '<h3>' + escapeHtml(product.name) + '</h3>' +
      '<p>' + escapeHtml(product.weight) +
      ' · <span class="product-price">' + product.price + ' جنيه</span> ' +
      status + ' ' + productOptions.join(" ") + '</p></div>' +
      '<div class="row-actions">' +
      '<button class="edit-button" data-action="edit" data-id="' + product.id + '">' +
      '<i class="fa-solid fa-pen"></i> تعديل</button>' +
      '<button class="delete-button" data-action="delete" data-id="' + product.id + '">' +
      '<i class="fa-solid fa-trash"></i> حذف</button>' +
      '</div></article>';
  }).join("");
}

// إظهار معاينة الصورة
function previewImage(file) {
  var preview = document.getElementById("imagePreview");
  var container = document.getElementById("imagePreviewContainer");

  if (!preview || !container) {
    return;
  }

  if (preview.dataset.objectUrl) {
    URL.revokeObjectURL(preview.dataset.objectUrl);
    delete preview.dataset.objectUrl;
  }

  if (!file) {
    container.hidden = true;
    preview.removeAttribute("src");
    return;
  }

  var objectUrl = URL.createObjectURL(file);
  preview.src = objectUrl;
  preview.dataset.objectUrl = objectUrl;
  container.hidden = false;
}

var imageInput = field("image_file");

if (imageInput) {
  imageInput.addEventListener("change", function () {
    var file = imageInput.files[0];

    if (file && !file.type.startsWith("image/")) {
      showMessage(document.getElementById("formMessage"), "اختر ملف صورة صالحًا.");
      imageInput.value = "";
      previewImage(null);
      return;
    }

    showMessage(document.getElementById("formMessage"), "");
    previewImage(file);
  });
}

// فتح نموذج الإضافة أو التعديل
function openEditor(product) {
  productForm.reset();
  field("id").value = "";
  field("available").checked = true;
  previewImage(null);
  showMessage(document.getElementById("formMessage"), "");

  if (product) {
    document.getElementById("editorTitle").textContent = "تعديل المنتج";

    field("id").value = product.id;
    field("name").value = product.name;
    field("weight").value = product.weight;
    field("price").value = product.price;
    field("available").checked = product.available;
    field("is_preorder").checked = product.is_preorder;
    field("available_from").value = product.available_from || "";
    field("available_until").value = product.available_until || "";

    // عرض الصورة القديمة دون محاولة وضعها داخل حقل الملفات
    if (product.image_url) {
      var preview = document.getElementById("imagePreview");
      var container = document.getElementById("imagePreviewContainer");

      if (preview && container) {
        preview.src = product.image_url;
        container.hidden = false;
      }
    }
  } else {
    document.getElementById("editorTitle").textContent = "إضافة منتج جديد";
  }

  editorSection.classList.remove("hidden");
  editorSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeEditor() {
  editorSection.classList.add("hidden");
  productForm.reset();
  previewImage(null);
}

document.getElementById("newProductButton").addEventListener("click", function () {
  openEditor(null);
});

document.getElementById("cancelEditButton").addEventListener("click", closeEditor);
document.getElementById("cancelEditButton2").addEventListener("click", closeEditor);
document.getElementById("refreshButton").addEventListener("click", loadProducts);

// حفظ المنتج ورفع الصورة عند اختيار صورة جديدة
productForm.addEventListener("submit", function (event) {
  event.preventDefault();

  var formMessage = document.getElementById("formMessage");
  var id = field("id").value;
  var imageFile = field("image_file").files[0];

  var oldProduct = products.find(function (product) {
    return String(product.id) === String(id);
  });

  // الاحتفاظ بالصورة القديمة عند عدم اختيار صورة جديدة
  var oldImageUrl = oldProduct ? oldProduct.image_url || "" : "";

  var productData = {
    name: field("name").value.trim(),
    weight: field("weight").value.trim(),
    price: Number(field("price").value),
    image_url: oldImageUrl,
    available: field("available").checked,
    is_preorder: field("is_preorder").checked,
    available_from: field("available_from").value || null,
    available_until: field("available_until").value || null
  };

  var url = id ? "/api/admin/products/" + id : "/api/admin/products";
  var method = id ? "PUT" : "POST";

  var imagePromise = Promise.resolve(oldImageUrl);

  if (imageFile) {
    showMessage(formMessage, "جارٍ رفع الصورة...");
    imagePromise = uploadImage(imageFile);
  }

  imagePromise.then(function (imageUrl) {
    productData.image_url = imageUrl;
    showMessage(formMessage, "جارٍ حفظ المنتج...");

    return request(url, {
      method: method,
      body: JSON.stringify(productData)
    });
  }).then(function () {
    closeEditor();
    showMessage(globalMessage, "تم حفظ المنتج بنجاح.");
    loadProducts();
  }).catch(function (error) {
    showMessage(formMessage, error.message);
  });
});

document.getElementById("accountForm").addEventListener("submit", function (event) {
  event.preventDefault();
  var accountForm = event.target;
  var username = accountForm.elements.namedItem("username").value.trim();
  var newPassword = accountForm.elements.namedItem("new_password").value;
  var message = document.getElementById("accountMessage");

  if (!username && !newPassword) {
    showMessage(message, "أدخل اسم مستخدم جديد أو كلمة مرور جديدة.");
    return;
  }

  request("/api/admin/account", {
    method: "PUT",
    body: JSON.stringify({
      current_password: accountForm.elements.namedItem("current_password").value,
      username: username || null,
      new_password: newPassword || null
    })
  }).then(function (data) {
    showMessage(message, data.message);
    accountForm.reset();
  }).catch(function (error) {
    showMessage(message, error.message);
  });
});

// تعديل المنتجات أو حذفها
productsList.addEventListener("click", function (event) {
  var button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  var productId = Number(button.dataset.id);
  var product = products.find(function (item) {
    return item.id === productId;
  });

  if (!product) {
    return;
  }

  if (button.dataset.action === "edit") {
    openEditor(product);
    return;
  }

  if (button.dataset.action === "delete") {
    if (!window.confirm("هل تريد حذف المنتج «" + product.name + "»؟")) {
      return;
    }

    request("/api/admin/products/" + productId, {
      method: "DELETE"
    }).then(function () {
      showMessage(globalMessage, "تم حذف المنتج.");
      loadProducts();
    }).catch(function (error) {
      showMessage(globalMessage, error.message);
    });
  }
});

// تسجيل الخروج
document.getElementById("logoutButton").addEventListener("click", function () {
  request("/api/admin/logout", {
    method: "POST"
  }).catch(function () {});

  token = "";
  sessionStorage.removeItem("fresh_admin_token");
  showLogin();
});

// تحديد الصفحة التي تظهر عند فتح اللوحة
if (token) {
  showDashboard();
} else {
  showLogin();
}
