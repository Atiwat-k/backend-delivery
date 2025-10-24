const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const admin = require("firebase-admin");
const path = require("path");
const bcrypt = require("bcrypt"); 
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");
// Firebase service account
const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),

});

const db = admin.firestore();


const app = express();
const PORT = 3000;

// Supabase config
const supabaseUrl = "https://hhrmjwculfjeoqlmenlu.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhocm1qd2N1bGZqZW9xbG1lbmx1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIyOTE5MiwiZXhwIjoyMDc2ODA1MTkyfQ.r8zq6lp5pE6MH-OTDE-SOvvkXZWg5B0QRNIO0uvt-8U"; // 🔥 ใช้ Service Role Key สำหรับ upload
const supabase = createClient(supabaseUrl, supabaseKey);

// Multer config
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use("/assets", express.static(path.join(__dirname, "assets")));

// ==================== Register User + Upload Image ====================
// ==================== Register User + Upload Image (Convert to PNG) ====================
app.post("/register_user", upload.single("image"), async (req, res) => {
  try {
    const { name, phone, password, full_address, latitude, longitude } = req.body;

    // ✅ ตรวจสอบอีเมลซ้ำ
    const snapshot = await db.collection("users").where("phone", "==", phone).get();
    if (!snapshot.empty) {
      return res.status(400).json({ success: false, message: "อีเมลนี้ถูกใช้แล้ว" });
    }

    // ✅ เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ สุ่ม user ID 7 หลัก
    let userId;
    let exists = true;
    while (exists) {
      userId = crypto.randomInt(1000000, 9999999).toString();
      const doc = await db.collection("users").doc(userId).get();
      exists = doc.exists;
    }

    // ✅ Upload image ไป Supabase (แปลงไฟล์เป็น PNG ก่อน)
    let imageUrl = "";
    if (req.file) {
      // แปลง Buffer → PNG
      const pngBuffer = await sharp(req.file.buffer).png().toBuffer();

      const fileName = `${userId}.png`; // บังคับให้เป็น .png เสมอ

      const { data, error } = await supabase.storage
        .from("user-image")
        .upload(fileName, pngBuffer, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/png",
        });

      if (error) {
        console.error("Supabase upload error:", error);
        return res.status(500).json({ success: false, message: "Upload รูปไม่สำเร็จ" });
      }

      // ✅ สร้าง public URL
      const { data: publicData } = supabase.storage.from("user-image").getPublicUrl(fileName);
      imageUrl = publicData.publicUrl;
    }

    // ✅ บันทึก Users
    await db.collection("users").doc(userId).set({
      phone,
      name,
      image: imageUrl,
      password: hashedPassword,
      role: "user",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ✅ บันทึก Address
    const address_id = crypto.randomInt(1000000, 9999999).toString();
    await db.collection("address").doc(address_id).set({
      user_id: userId,
      full_address,
      latitude,
      longitude,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ success: true, id: userId, image: imageUrl });

  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== Register Rider ====================
// ==================== Register Rider + Upload Image ====================
app.post("/register_rider", upload.single("image"), async (req, res) => {
  try {
    const { name, phone, car, password } = req.body;

    // ตรวจสอบอีเมลซ้ำ
    const snapshot = await db.collection("riders").where("phone", "==", phone).get();
    if (!snapshot.empty) {
      return res.status(400).json({ success: false, message: "อีเมลนี้ถูกใช้แล้ว" });
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    // สุ่ม rider ID 7 หลัก
    let riderId;
    let exists = true;
    while (exists) {
      riderId = crypto.randomInt(1000000, 9999999).toString();
      const doc = await db.collection("riders").doc(riderId).get();
      exists = doc.exists;
    }

    // Upload image ไป Supabase (แปลงไฟล์เป็น PNG ก่อน)
    let imageUrl = "";
    if (req.file) {
      const pngBuffer = await sharp(req.file.buffer).png().toBuffer();
      const fileName = `${riderId}.png`; // บังคับให้เป็น .png

      const { data, error } = await supabase.storage
        .from("rider-image")
        .upload(fileName, pngBuffer, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/png",
        });

      if (error) {
        console.error("Supabase upload error:", error);
        return res.status(500).json({ success: false, message: "Upload รูปไม่สำเร็จ" });
      }

      const { data: publicData } = supabase.storage.from("rider-image").getPublicUrl(fileName);
      imageUrl = publicData.publicUrl;
    }

    // บันทึกข้อมูล Rider
    await db.collection("riders").doc(riderId).set({
      name,
      phone,
      car,
      image: imageUrl,
      password: hashedPassword,
      role: "rider",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ success: true, id: riderId, image: imageUrl });

  } catch (error) {
    console.error("❌ Error in /register_rider:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// ==================== Login User ====================
app.post("/login_user", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const snapshot = await db.collection("users").where("phone", "==", phone).get();
    if (snapshot.empty) {
      return res.status(401).json({ success: false, message: "ไม่พบเบอร์นี้ในระบบ" });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();
    const id = userDoc.id;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "รหัสผ่านไม่ถูกต้อง" });
    }

    res.status(200).json({ success: true, id, ...user });

  } catch (error) {
    console.error("❌ Error in /login_user:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== Login Rider ====================
app.post("/login_rider", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const snapshot = await db.collection("riders").where("phone", "==", phone).get();
    if (snapshot.empty) {
      return res.status(401).json({ success: false, message: "ไม่พบอีเมลนี้ในระบบ" });
    }

    const riderDoc = snapshot.docs[0];
    const rider = riderDoc.data();
    const id = riderDoc.id;

    const isMatch = await bcrypt.compare(password, rider.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "รหัสผ่านไม่ถูกต้อง" });
    }

    res.status(200).json({ success: true, id, ...rider });

  } catch (error) {
    console.error("❌ Error in /login_rider:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/user/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const doc = await db.collection("users").doc(userId).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userData = doc.data();
    
    // ดึง address ด้วย
    const addressSnapshot = await db.collection("address")
      .where("user_id", "==", userId)
      .get();
    
    let addresses = [];
    addressSnapshot.forEach((doc) => {
      addresses.push(doc.data());
    });

    res.status(200).json({
      success: true,
      user: userData,
      addresses,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
// ==================== Search User by Phone ====================
app.get("/search_user", async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone || phone.trim() === "") {
      return res.status(400).json({ success: false, message: "กรุณากรอกเบอร์โทร" });
    }

    // Firestore ไม่มี operator "contains" ตรงๆ สำหรับ field string
    // ดังนั้นเราจะดึงทั้งหมดแล้วกรองใน Node.js
    const snapshot = await db.collection("users").get();
    const results = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.phone && data.phone.includes(phone)) {
        results.push({
          id: doc.id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          image: data.image || "",
        });
      }
    });

    res.status(200).json({ success: true, results });
  } catch (error) {
    console.error("Search user error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
// ==================== Create Delivery ====================

app.post('/create_delivery', upload.array('photos'), async (req, res) => {
  const { sender_id, receiver_id, pickup_address, dropoff_address, rider_id, items } = req.body;

  try {
    const itemsData = JSON.parse(items); // รับ items จาก Flutter

    // สร้างเลข 6 หลักแบบสุ่ม
    const delivery_id = Math.floor(100000 + Math.random() * 900000).toString();

    // สร้าง document delivery หลัก
    const deliveryRef = db.collection('deliveries').doc(delivery_id);
    await deliveryRef.set({
      delivery_id,
      sender_id,
      receiver_id,
      pickup_address,
      dropoff_address,
      rider_id: rider_id || null,
      current_status: 1,
      created: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ==================== สร้าง Delivery_Item ====================
    for (let i = 0; i < itemsData.length; i++) {
      const item = itemsData[i];
      let photoUrl = null;

      if (req.files && req.files[i]) {
        const fileBuffer = await sharp(req.files[i].buffer).png().toBuffer();
        const fileName = `delivery_${delivery_id}_item_${i}.png`;

        const { data, error } = await supabase.storage
          .from('delivery-items')
          .upload(fileName, fileBuffer, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/png',
          });

        if (!error) {
          const { data: publicData } = supabase.storage
            .from('delivery-items')
            .getPublicUrl(fileName);
          photoUrl = publicData.publicUrl;
        } else {
          console.error('Supabase upload error:', error);
        }
      }

      // เก็บลง collection Delivery_Item
      const itemRef = db.collection('delivery_item').doc(); // PK อัตโนมัติ
      await itemRef.set({
        item_id: itemRef.id,       // PK
        delivery_id,               // FK
        description: item.description,
        quantity: item.quantity,
        weight: item.weight,
        photo_url: photoUrl,
      });
    }

    // ==================== สร้าง Delivery_Photo ====================
    for (let j = 0; j < (req.files ? req.files.length : 0); j++) {
      const photoFile = req.files[j];
      let photoUrl = null;

      if (photoFile) {
        const fileBuffer = await sharp(photoFile.buffer).png().toBuffer();
        const fileName = `delivery_${delivery_id}_photo_${j}.png`;

        const { data, error } = await supabase.storage
          .from('delivery-photos')
          .upload(fileName, fileBuffer, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/png',
          });

        if (!error) {
          const { data: publicData } = supabase.storage
            .from('delivery-photos')
            .getPublicUrl(fileName);
          photoUrl = publicData.publicUrl;
        } else {
          console.error('Supabase upload error:', error);
        }
      }

      const photoRef = db.collection('delivery_photo').doc(); // PK อัตโนมัติ
      await photoRef.set({
        photo_id: photoRef.id,   // PK
        delivery_id,             // FK
        status: 2,               // default 1
        upload_by: 'user',       // ใส่ตาม role
        photo_url: photoUrl,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json({ success: true, message: 'Delivery created', delivery_id });
  } catch (err) {
    console.error('Create delivery error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== Get Delivery By ID ====================
app.get('/delivery/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deliveryDoc = await db.collection('deliveries').doc(id).get();
    if (!deliveryDoc.exists) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }
    const delivery = deliveryDoc.data();

    // ดึง items
    const itemsSnap = await db.collection('deliveries').doc(id).collection('items').get();
    const items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // ดึง photos
    const photosSnap = await db.collection('deliveries').doc(id).collection('photos').get();
    const photos = photosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, delivery: { ...delivery, items, photos } });
  } catch (err) {
    console.error('Get delivery error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/address_location/:id', async (req, res) => {
  try {
    const addressId = req.params.id;

    // ดึง document จาก collection "address" ตาม ID
    const doc = await db.collection("address").doc(addressId).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "ไม่พบที่อยู่" });
    }

    const addressData = doc.data();

    res.status(200).json({
      success: true,
      latitude: addressData.latitude,
      longitude: addressData.longitude,
      full_address: addressData.full_address
    });

  } catch (error) {
    console.error("Get address error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// backend - main.js
app.get('/user_addresses/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const snapshot = await db.collection('address')
      .where('user_id', '==', user_id)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ success: false, message: 'No addresses found' });
    }

    const addresses = snapshot.docs.map(doc => ({
      address_id: doc.id,
      full_address: doc.data().full_address,
      latitude: doc.data().latitude,
      longitude: doc.data().longitude,
      user_id: doc.data().user_id
    }));

    res.json({ success: true, addresses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /users
app.get('/users', async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();
    const users = [];

    usersSnapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ API: ดึง Delivery ทั้งหมดที่ sender_id = คนนี้
app.get('/get_my_deliveries/:senderId', async (req, res) => {
  try {
    const senderId = req.params.senderId;

    const deliveriesSnapshot = await db
      .collection('deliveries')
      .where('sender_id', '==', senderId)
      .get();

    if (deliveriesSnapshot.empty) {
      return res.json({ success: true, deliveries: [] });
    }

    const results = [];
    for (const doc of deliveriesSnapshot.docs) {
      const data = doc.data();
      const receiverRef = await db.collection('users').doc(data.receiver_id).get();

      results.push({
        delivery_id: doc.id,
        pickup_address: data.pickup_address,
        dropoff_address: data.dropoff_address,
        current_status: data.current_status,
        created: data.created,
        receiver: receiverRef.exists ? receiverRef.data() : null
      });
    }

    res.json({ success: true, deliveries: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ GET /get_my_received/:receiverId
app.get('/get_my_received/:receiverId', async (req, res) => {
  try {
    const receiverId = req.params.receiverId;

    // ดึง delivery ที่ receiver_id = คนนี้
    const deliveriesSnapshot = await db
      .collection('deliveries')
      .where('receiver_id', '==', receiverId)
      .get();

    if (deliveriesSnapshot.empty) {
      return res.json({ success: true, deliveries: [] });
    }

    const results = [];
    for (const doc of deliveriesSnapshot.docs) {
      const data = doc.data();

      // ดึงข้อมูลผู้ส่ง
      const senderRef = await db.collection('users').doc(data.sender_id).get();

      results.push({
        delivery_id: doc.id,
        pickup_address: data.pickup_address,
        dropoff_address: data.dropoff_address,
        current_status: data.current_status,
        created: data.created,
        sender: senderRef.exists ? senderRef.data() : null
      });
    }

    res.json({ success: true, deliveries: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/get_delivery_items/:deliveryId', async (req, res) => {
  try {
    const deliveryId = req.params.deliveryId;

    // ดึง items ทั้งหมดจาก collection Delivery_Item ตาม delivery_id
    const itemsSnapshot = await db
      .collection('delivery_item')
      .where('delivery_id', '==', deliveryId)
      .get();

    // แปลง snapshot เป็น array ของ object
    const items = itemsSnapshot.docs.map(doc => doc.data());

    res.json({
      success: true,
      delivery_id: deliveryId,
      items: items
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/get_delivery/:deliveryId', async (req, res) => {
  try {
    const deliveryId = req.params.deliveryId;

    // ดึง document จาก collection 'deliveries'
    const deliveryDoc = await db.collection('deliveries').doc(deliveryId).get();

    if (!deliveryDoc.exists) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    const deliveryData = deliveryDoc.data();

    // ส่ง response แค่ข้อมูล Delivery
    res.json({
      success: true,
      delivery: {
        delivery_id: deliveryDoc.id,
        sender_id: deliveryData.sender_id || null,
        receiver_id: deliveryData.receiver_id || null,
        pickup_address: deliveryData.pickup_address || null,
        dropoff_address: deliveryData.dropoff_address || null,
        rider_id: deliveryData.rider_id || null,
        current_status: deliveryData.current_status || null,
        created: deliveryData.created || null,
      },
    });
  } catch (err) {
    console.error('Get delivery error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// ดึงข้อมูล Rider เฉพาะ collection "riders"
app.get("/rider/:id", async (req, res) => {
  try {
    const riderId = req.params.id;

    // ดึงข้อมูล Rider จาก collection "riders"
    const riderDoc = await db.collection("riders").doc(riderId).get();

    if (!riderDoc.exists) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const riderData = riderDoc.data();

    // เตรียมข้อมูล response ตามที่เก็บจริง
    const responseData = {
      rider_id: riderDoc.id,
      name: riderData.name || '',
      phone: riderData.phone || '',
      car: riderData.car || '',
      image: riderData.image || '',
    };

    res.status(200).json({ success: true, rider: responseData });
  } catch (error) {
    console.error("Get rider error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
// GET /deliveries_pending
app.get("/deliveries_pending", async (req, res) => {
  try {
    const deliveriesSnapshot = await db.collection("deliveries")
      .where("current_status", "==", 1) // เฉพาะงานรอรับ
      .get();

    if (deliveriesSnapshot.empty) {
      return res.status(200).json({ success: true, deliveries: [] });
    }

    const deliveries = await Promise.all(
      deliveriesSnapshot.docs.map(async doc => {
        const data = doc.data();

        // ดึงข้อมูล sender
        let sender = {};
        if (data.sender_id) {
          const senderDoc = await db.collection("users").doc(data.sender_id).get();
          sender = senderDoc.exists ? senderDoc.data() : {};
        }

        // ดึงข้อมูล receiver
        let receiver = {};
        if (data.receiver_id) {
          const receiverDoc = await db.collection("users").doc(data.receiver_id).get();
          receiver = receiverDoc.exists ? receiverDoc.data() : {};
        }

        return {
          delivery_id: doc.id,
          pickup_address: data.pickup_address || "",
          dropoff_address: data.dropoff_address || "",
          current_status: data.current_status || 1,
          sender,
          receiver,
          sender_id: data.sender_id || "",
          receiver_id: data.receiver_id || "",
          rider_id: data.rider_id || "",
        };
      })
    );

    res.status(200).json({ success: true, deliveries });
  } catch (error) {
    console.error("Error fetching pending deliveries:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /update_delivery/:id
app.put("/update_delivery/:id", async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { current_status, rider_id } = req.body;

    if (!current_status || !rider_id) {
      return res.status(400).json({
        success: false,
        message: "กรุณาส่ง current_status และ rider_id"
      });
    }

    const deliveryRef = db.collection("deliveries").doc(deliveryId);
    const doc = await deliveryRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "Delivery ไม่พบ" });
    }

    await deliveryRef.update({
      current_status,
      rider_id
    });

    return res.status(200).json({
      success: true,
      message: "อัปเดตสถานะ delivery สำเร็จ",
      delivery_id: deliveryId
    });
  } catch (error) {
    console.error("Error updating delivery:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/delivery_photo/:deliveryId", upload.single("photo"), async (req, res) => {
  try {
    const { deliveryId } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "ไม่มีไฟล์ถูกอัปโหลด" });
    }

    // 1️⃣ หา status สูงสุดของ delivery_photo ของ deliveryId นี้
    const snapshot = await db.collection("delivery_photo")
      .where("delivery_id", "==", deliveryId)
      .get();

    let maxStatus = 0;
    if (!snapshot.empty) {
      maxStatus = snapshot.docs
        .map(doc => doc.data().status)
        .reduce((a, b) => Math.max(a, b), 0);
    }

    // ถ้า status สูงสุดคือ 4 แล้ว ไม่ต้องอัปโหลด
    if (maxStatus >= 4) {
      return res.status(400).json({ success: false, message: "รูปสุดท้ายแล้ว ไม่สามารถอัปโหลดเพิ่มได้" });
    }

    const newStatus = maxStatus + 1;

    // 2️⃣ แปลงรูปเป็น PNG
    const pngBuffer = await sharp(req.file.buffer).png().toBuffer();
    const fileName = `${deliveryId}_${Date.now()}.png`;

    // 3️⃣ อัปโหลดไป Supabase
    const { data, error } = await supabase.storage
      .from("delivery-photos")
      .upload(fileName, pngBuffer, {
        cacheControl: "3600",
        upsert: true,
        contentType: "image/png",
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return res.status(500).json({ success: false, message: "Upload รูปไม่สำเร็จ" });
    }

    // 4️⃣ สร้าง public URL
    const { data: publicData } = supabase.storage.from("delivery-photos").getPublicUrl(fileName);
    const imageUrl = publicData.publicUrl;

    // 5️⃣ สร้าง record ใหม่ใน Firestore สำหรับ delivery_photo
    await db.collection("delivery_photo").doc().set({
      delivery_id: deliveryId,
      status: newStatus,
      photo: imageUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 6️⃣ เพิ่ม current_status ใน collection deliveries ทีละ 1
    const deliveryRef = db.collection("deliveries").doc(deliveryId);
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(deliveryRef);
      if (!doc.exists) throw new Error("Delivery ไม่พบในระบบ");

      const currentStatus = doc.data().current_status || 0;
      transaction.update(deliveryRef, { current_status: currentStatus + 1 });
    });

    return res.json({ success: true, photo: imageUrl, status: newStatus });
  } catch (err) {
    console.error("Error uploading delivery photo:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/delivery_photos/:deliveryId", async (req, res) => {
  try {
    const deliveryId = req.params.deliveryId;

    // query string ก่อน
    let photosSnap = await db
      .collection("delivery_photo")
      .where("delivery_id", "==", deliveryId)
      .get();

    // ถ้าไม่เจอ ลอง query เป็น number
    if (photosSnap.empty && !isNaN(Number(deliveryId))) {
      photosSnap = await db
        .collection("delivery_photo")
        .where("delivery_id", "==", Number(deliveryId))
        .get();
    }

    if (photosSnap.empty) {
      return res
        .status(404)
        .json({ success: false, message: "No photos found for this delivery" });
    }

    const photos = [];
    photosSnap.forEach((doc) => {
      const data = doc.data();
      photos.push({
        id: doc.id,
        delivery_id: data.delivery_id || '',
        photo: data.photo || '', // URL ของรูป
        status: data.status || 0,
      });
    });

    res.status(200).json({ success: true, photos });
  } catch (error) {
    console.error("Get delivery photos error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});



// ==================== Server Start ====================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});