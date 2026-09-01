/**
 * Módulo: Shop Admin (Catálogo)
 * Gestiona categorías, subcategorías y productos para la tienda.
 */

(function () {
  'use strict';

  // Refs
  const viewShop = document.getElementById('view-shop');
  const btnNewCategory = document.getElementById('btnNewCategory');
  const btnNewSubcategory = document.getElementById('btnNewSubcategory');
  const btnNewProduct = document.getElementById('btnNewProduct');
  const categoriesList = document.getElementById('shopCategoriesList');
  const subcategoriesList = document.getElementById('shopSubcategoriesList');
  const productsList = document.getElementById('shopProductsList');

  // Estado global simple para no refetchear al editar si no es necesario (opcional, pero refetchear es más seguro)
  let rawCats = [];
  let rawSubcats = [];
  let rawProds = [];

  // Listeners para navegación del tab
  document.addEventListener('DOMContentLoaded', () => {
    const shopTab = document.querySelector('.tab-chip[data-view="shop"]');
    if (shopTab) {
      shopTab.addEventListener('click', (e) => {
        document.querySelectorAll('.view-container').forEach(v => v.classList.add('hidden'));
        document.querySelectorAll('.tab-chip').forEach(t => t.classList.remove('active'));
        viewShop.classList.remove('hidden');
        shopTab.classList.add('active');
        loadShopData();
      });
    }

    if (btnNewCategory) btnNewCategory.addEventListener('click', handleNewCategory);
    if (btnNewSubcategory) btnNewSubcategory.addEventListener('click', handleNewSubcategory);
    if (btnNewProduct) btnNewProduct.addEventListener('click', () => openProductModal(null));
  });

  async function loadShopData() {
    try {
      window.Toast?.info('Cargando catálogo...', 1000);
      
      const { data: cats, error: errCats } = await window.sb
        .from('shop_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (errCats) throw errCats;

      const { data: subcats, error: errSubcats } = await window.sb
        .from('shop_subcategories')
        .select('*, shop_categories(name)')
        .order('sort_order', { ascending: true });

      if (errSubcats) throw errSubcats;

      const { data: prods, error: errProds } = await window.sb
        .from('shop_products')
        .select('*, shop_categories(name), shop_subcategories(name)')
        .order('sort_order', { ascending: true });

      if (errProds) throw errProds;

      rawCats = cats || [];
      rawSubcats = subcats || [];
      rawProds = prods || [];

      renderCategories(rawCats);
      renderSubcategories(rawSubcats);
      renderProducts(rawProds);
      
    } catch (error) {
      console.error('Error al cargar datos:', error);
      window.Toast?.error(`Error al cargar tienda: ${error.message || 'Desconocido'}`);
    }
  }

  function renderCategories(cats) {
    if (!categoriesList) return;
    if (cats.length === 0) {
      categoriesList.innerHTML = '<div style="padding:16px;color:var(--neutral-500);">No hay categorías</div>';
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>NOMBRE</th>
            <th>ORDEN</th>
            <th>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
    `;

    cats.forEach(c => {
      html += `
        <tr>
          <td class="font-mono text-xs text-neutral-400">${c.id.split('-')[0]}</td>
          <td class="font-bold">${c.name}</td>
          <td>${c.sort_order}</td>
          <td>
            <button class="btn-ghost btn-sm" onclick="window.editCategory('${c.id}')">Editar</button>
            <button class="btn-ghost btn-sm text-red" onclick="window.deleteCategory('${c.id}')">Eliminar</button>
          </td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    categoriesList.innerHTML = html;
  }

  function renderSubcategories(subcats) {
    if (!subcategoriesList) return;
    if (subcats.length === 0) {
      subcategoriesList.innerHTML = '<div style="padding:16px;color:var(--neutral-500);">No hay subcategorías</div>';
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>NOMBRE</th>
            <th>CATEGORÍA PADRE</th>
            <th>ORDEN</th>
            <th>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
    `;

    subcats.forEach(c => {
      const catName = c.shop_categories?.name || 'N/A';
      html += `
        <tr>
          <td class="font-mono text-xs text-neutral-400">${c.id.split('-')[0]}</td>
          <td class="font-bold">${c.name}</td>
          <td class="text-xs text-neutral-400">${catName}</td>
          <td>${c.sort_order}</td>
          <td>
            <button class="btn-ghost btn-sm" onclick="window.editSubcategory('${c.id}')">Editar</button>
            <button class="btn-ghost btn-sm text-red" onclick="window.deleteSubcategory('${c.id}')">Eliminar</button>
          </td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    subcategoriesList.innerHTML = html;
  }

  function renderProducts(prods) {
    if (!productsList) return;
    if (prods.length === 0) {
      productsList.innerHTML = '<div style="padding:16px;color:var(--neutral-500);">No hay productos</div>';
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>IMG</th>
            <th>NOMBRE</th>
            <th>CAT / SUBCAT</th>
            <th>ESTADO</th>
            <th>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
    `;

    prods.forEach(p => {
      const catName = p.shop_categories?.name || 'N/A';
      const subcatName = p.shop_subcategories?.name || '-';
      const statusBadge = p.is_active 
        ? '<span class="status-badge is-active">Activo</span>'
        : '<span class="status-badge is-inactive">Inactivo</span>';

      html += `
        <tr>
          <td><img src="${p.image_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" /></td>
          <td class="font-bold">${p.name}</td>
          <td class="text-xs text-neutral-400">${catName} > ${subcatName}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn-ghost btn-sm" onclick="window.openProductModal('${p.id}')">Editar</button>
            <button class="btn-ghost btn-sm" onclick="window.toggleProductStatus('${p.id}', ${!p.is_active})">Toggle</button>
            <button class="btn-ghost btn-sm text-red" onclick="window.deleteProduct('${p.id}')">Eliminar</button>
          </td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    productsList.innerHTML = html;
  }

  // --- Handlers CRUD Básicos ---

  async function handleNewCategory() {
    const name = prompt('Nombre de la categoría principal (ej. HOMBRE):');
    if (!name) return;
    const sort = prompt('Orden numérico (ej. 1, 2, 3):', '0');

    try {
      const { data, error } = await window.sb
        .from('shop_categories')
        .insert([{ name, sort_order: parseInt(sort) || 0 }])
        .select();

      if (error) throw error;
      window.Toast?.success('Categoría creada');
      loadShopData();
    } catch (error) {
      console.error('Error al crear categoría:', error);
      window.Toast?.error(`Error al crear: ${error.message || ''}`);
    }
  }

  async function handleNewSubcategory() {
    if (!rawCats || rawCats.length === 0) {
      alert('Debes crear una categoría principal primero.');
      return;
    }
    openSubcategoryModal(null);
  }

  function openSubcategoryModal(existingSubcatId = null) {
    let subcatToEdit = null;
    if (existingSubcatId) {
      subcatToEdit = rawSubcats.find(s => s.id === existingSubcatId);
    }

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const formBox = document.createElement('div');
    formBox.style.backgroundColor = '#111';
    formBox.style.padding = '24px';
    formBox.style.borderRadius = '8px';
    formBox.style.width = '400px';
    formBox.style.display = 'flex';
    formBox.style.flexDirection = 'column';
    formBox.style.gap = '16px';
    formBox.style.color = '#fff';
    formBox.style.fontFamily = 'monospace';

    const catOptions = rawCats.map(c => {
      const selected = (subcatToEdit && subcatToEdit.category_id === c.id) ? 'selected' : '';
      return `<option value="${c.id}" ${selected}>${c.name}</option>`;
    }).join('');

    formBox.innerHTML = `
      <h3 style="margin:0; font-size:18px;">${subcatToEdit ? 'Editar' : 'Nueva'} Subcategoría</h3>
      
      <label style="display:flex; flex-direction:column; gap:4px;">
        Nombre:
        <input type="text" id="sName" value="${subcatToEdit ? subcatToEdit.name : ''}" style="background:#000; border:1px solid #333; color:#fff; padding:8px;" required>
      </label>

      <label style="display:flex; flex-direction:column; gap:4px;">
        Categoría Principal:
        <select id="sCat" style="background:#000; border:1px solid #333; color:#fff; padding:8px;" required>
          ${!subcatToEdit ? '<option value="">Selecciona...</option>' : ''}
          ${catOptions}
        </select>
      </label>

      <label style="display:flex; flex-direction:column; gap:4px;">
        Orden (Numérico):
        <input type="number" id="sSort" value="${subcatToEdit ? subcatToEdit.sort_order : '0'}" style="background:#000; border:1px solid #333; color:#fff; padding:8px;" required>
      </label>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
        <button type="button" id="btnCancelSub" style="background:#333; color:#fff; border:none; padding:8px 16px; cursor:pointer;">Cancelar</button>
        <button type="button" id="btnSaveSub" style="background:#fff; color:#000; border:none; padding:8px 16px; cursor:pointer; font-weight:bold;">Guardar</button>
      </div>
    `;

    overlay.appendChild(formBox);
    document.body.appendChild(overlay);

    document.getElementById('btnCancelSub').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    document.getElementById('btnSaveSub').addEventListener('click', async () => {
      const name = document.getElementById('sName').value;
      const catId = document.getElementById('sCat').value;
      const sort = document.getElementById('sSort').value || 0;

      if (!name || !catId) {
        alert('Nombre y Categoría son obligatorios.');
        return;
      }

      const btnSave = document.getElementById('btnSaveSub');
      btnSave.innerText = 'Guardando...';
      btnSave.disabled = true;

      try {
        if (subcatToEdit) {
          const { error } = await window.sb
            .from('shop_subcategories')
            .update({ name, category_id: catId, sort_order: parseInt(sort) })
            .eq('id', subcatToEdit.id);
          if (error) throw error;
          window.Toast?.success('Subcategoría actualizada');
        } else {
          const { error } = await window.sb
            .from('shop_subcategories')
            .insert([{ name, category_id: catId, sort_order: parseInt(sort) }]);
          if (error) throw error;
          window.Toast?.success('Subcategoría creada');
        }
        
        document.body.removeChild(overlay);
        loadShopData();
      } catch (error) {
        console.error('Error al guardar subcategoría:', error);
        window.Toast?.error(`Error: ${error.message || ''}`);
        btnSave.innerText = 'Guardar';
        btnSave.disabled = false;
      }
    });
  }

  window.openProductModal = function(existingProductId = null) {
    if (!rawCats || rawCats.length === 0) {
      alert('Debes crear una categoría primero.');
      return;
    }

    let prodToEdit = null;
    if (existingProductId) {
      prodToEdit = rawProds.find(p => p.id === existingProductId);
    }

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const formBox = document.createElement('div');
    formBox.style.backgroundColor = '#111';
    formBox.style.padding = '24px';
    formBox.style.borderRadius = '8px';
    formBox.style.width = '400px';
    formBox.style.display = 'flex';
    formBox.style.flexDirection = 'column';
    formBox.style.gap = '16px';
    formBox.style.color = '#fff';
    formBox.style.fontFamily = 'monospace';
    formBox.style.maxHeight = '90vh';
    formBox.style.overflowY = 'auto';

    const catOptions = rawCats.map(c => {
      const selected = (prodToEdit && prodToEdit.category_id === c.id) ? 'selected' : '';
      return `<option value="${c.id}" ${selected}>${c.name}</option>`;
    }).join('');

    formBox.innerHTML = `
      <h3 style="margin:0; font-size:18px;">${prodToEdit ? 'Editar' : 'Nuevo'} Producto</h3>
      
      <label style="display:flex; flex-direction:column; gap:4px;">
        Nombre:
        <input type="text" id="pName" value="${prodToEdit ? prodToEdit.name : ''}" style="background:#000; border:1px solid #333; color:#fff; padding:8px;" required>
      </label>

      <label style="display:flex; flex-direction:column; gap:4px;">
        Categoría Principal:
        <select id="pCat" style="background:#000; border:1px solid #333; color:#fff; padding:8px;" required>
          ${!prodToEdit ? '<option value="">Selecciona...</option>' : ''}
          ${catOptions}
        </select>
      </label>

      <label style="display:flex; flex-direction:column; gap:4px;">
        Subcategoría (Opcional):
        <select id="pSubcat" style="background:#000; border:1px solid #333; color:#fff; padding:8px;">
          <option value="">Ninguna</option>
        </select>
      </label>

      <label style="display:flex; flex-direction:column; gap:4px;">
        URL Tiendanube:
        <input type="url" id="pUrl" value="${prodToEdit ? prodToEdit.tiendanube_url : ''}" style="background:#000; border:1px solid #333; color:#fff; padding:8px;" required>
      </label>

      <label style="display:flex; flex-direction:column; gap:4px;">
        Imagen ${prodToEdit ? '(Opcional: Subir nueva reemplaza la actual)' : ''}:
        <input type="file" id="pFile" accept="image/*" style="background:#000; border:1px solid #333; color:#fff; padding:8px;" ${!prodToEdit ? 'required' : ''}>
      </label>
      
      ${prodToEdit ? `<img src="${prodToEdit.image_url}" style="width:60px; height:60px; object-fit:cover; border-radius:4px; margin-top:-8px;"/>` : ''}

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
        <button type="button" id="btnCancelProduct" style="background:#333; color:#fff; border:none; padding:8px 16px; cursor:pointer;">Cancelar</button>
        <button type="button" id="btnSaveProduct" style="background:#fff; color:#000; border:none; padding:8px 16px; cursor:pointer; font-weight:bold;">Guardar</button>
      </div>
    `;

    overlay.appendChild(formBox);
    document.body.appendChild(overlay);

    // Lógica de selects en cascada
    const pCat = document.getElementById('pCat');
    const pSubcat = document.getElementById('pSubcat');
    
    const populateSubcats = (catId) => {
      const filteredSubcats = rawSubcats.filter(sc => sc.category_id === catId);
      let subcatHtml = '<option value="">Ninguna</option>';
      filteredSubcats.forEach(sc => {
        const selected = (prodToEdit && prodToEdit.subcategory_id === sc.id) ? 'selected' : '';
        subcatHtml += `<option value="${sc.id}" ${selected}>${sc.name}</option>`;
      });
      pSubcat.innerHTML = subcatHtml;
    };

    pCat.addEventListener('change', () => populateSubcats(pCat.value));
    
    // Si estamos editando, poblar subcategorías iniciales
    if (prodToEdit && prodToEdit.category_id) {
      populateSubcats(prodToEdit.category_id);
    }

    // Botones
    document.getElementById('btnCancelProduct').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    document.getElementById('btnSaveProduct').addEventListener('click', async () => {
      const name = document.getElementById('pName').value;
      const catId = pCat.value;
      const subcatId = pSubcat.value || null;
      const tiendanube = document.getElementById('pUrl').value;
      const file = document.getElementById('pFile').files[0];

      if (!name || !catId || !tiendanube) {
        alert('Completa todos los campos obligatorios.');
        return;
      }
      if (!prodToEdit && !file) {
        alert('Selecciona una imagen.');
        return;
      }

      const btnSave = document.getElementById('btnSaveProduct');
      btnSave.innerText = 'Guardando...';
      btnSave.disabled = true;

      try {
        let imgUrl = prodToEdit ? prodToEdit.image_url : '';

        if (file) {
          window.Toast?.info('Subiendo nueva imagen...', 2000);
          const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
          
          const { data: uploadData, error: uploadErr } = await window.sb
            .storage
            .from('shop_images')
            .upload(fileName, file, { cacheControl: '3600', upsert: false });
          
          if (uploadErr) throw uploadErr;

          const { data: publicUrlData } = window.sb
            .storage
            .from('shop_images')
            .getPublicUrl(fileName);

          imgUrl = publicUrlData.publicUrl;
        }

        const payload = {
          name: name,
          category_id: catId,
          subcategory_id: subcatId,
          image_url: imgUrl,
          tiendanube_url: tiendanube
        };

        if (prodToEdit) {
          const { error: updateErr } = await window.sb
            .from('shop_products')
            .update(payload)
            .eq('id', prodToEdit.id);
          if (updateErr) throw updateErr;
          window.Toast?.success('Producto actualizado');
        } else {
          payload.is_active = true;
          const { error: insertErr } = await window.sb
            .from('shop_products')
            .insert([payload]);
          if (insertErr) throw insertErr;
          window.Toast?.success('Producto creado');
        }
        
        document.body.removeChild(overlay);
        loadShopData();
      } catch (err) {
        console.error('Error al guardar producto:', err);
        window.Toast?.error(`Error: ${err.message || ''}`);
        btnSave.innerText = 'Guardar';
        btnSave.disabled = false;
      }
    });
  };

  // --- Funciones Globales para los onclick en HTML ---

  window.editCategory = async (id) => {
    const cat = rawCats.find(c => c.id === id);
    if (!cat) return;
    const name = prompt('Nuevo nombre de categoría:', cat.name);
    if (!name || name === cat.name) return;
    
    try {
      const { error } = await window.sb.from('shop_categories').update({ name }).eq('id', id);
      if (error) throw error;
      window.Toast?.success('Categoría actualizada');
      loadShopData();
    } catch (error) {
      console.error(error);
      window.Toast?.error('Error al actualizar');
    }
  };

  window.editSubcategory = (id) => {
    openSubcategoryModal(id);
  };

  window.deleteCategory = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar esta categoría? Se borrarán sus productos.')) return;
    try {
      const { error } = await window.sb.from('shop_categories').delete().eq('id', id);
      if (error) throw error;
      window.Toast?.success('Categoría eliminada');
      loadShopData();
    } catch (error) {
      console.error(error);
      window.Toast?.error('Error al eliminar');
    }
  };

  window.deleteSubcategory = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar esta subcategoría?')) return;
    try {
      const { error } = await window.sb.from('shop_subcategories').delete().eq('id', id);
      if (error) throw error;
      window.Toast?.success('Subcategoría eliminada');
      loadShopData();
    } catch (error) {
      console.error(error);
      window.Toast?.error('Error al eliminar');
    }
  };

  window.deleteProduct = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar este producto?')) return;
    try {
      const { error } = await window.sb.from('shop_products').delete().eq('id', id);
      if (error) throw error;
      window.Toast?.success('Producto eliminado');
      loadShopData();
    } catch (error) {
      console.error(error);
      window.Toast?.error('Error al eliminar');
    }
  };

  window.toggleProductStatus = async (id, newStatus) => {
    try {
      const { error } = await window.sb.from('shop_products').update({ is_active: newStatus }).eq('id', id);
      if (error) throw error;
      window.Toast?.success('Estado actualizado');
      loadShopData();
    } catch (error) {
      console.error(error);
      window.Toast?.error('Error al actualizar');
    }
  };

})();
