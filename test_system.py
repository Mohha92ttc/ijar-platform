import requests
import json
import time

# إعدادات النظام
BASE_URL = "http://localhost:3000/api"
FRONTEND_URL = "http://localhost:5173"

# بيانات المستخدمين
ADMIN_USER = {
    "email": "admin@ijar.iq",
    "password": "admin123"
}

PARTNER_USER = {
    "email": "partner@example.com",
    "password": "password123"
}

CUSTOMER_USER = {
    "email": "customer@example.com", 
    "password": "password123"
}

class SystemTester:
    def __init__(self):
        self.tokens = {}
        self.session = requests.Session()
        
    def login(self, user_data, user_type):
        """تسجيل الدخول"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=user_data)
            if response.status_code == 200:
                data = response.json()
                self.tokens[user_type] = data.get('token')
                print(f"✅ تسجيل الدخول كـ {user_type} بنجاح")
                return True
            else:
                print(f"❌ فشل تسجيل الدخول كـ {user_type}: {response.text}")
                return False
        except Exception as e:
            print(f"❌ خطأ في تسجيل الدخول كـ {user_type}: {str(e)}")
            return False
    
    def test_admin_features(self):
        """اختبار وظائف الأدمن"""
        print("\n🔐 اختبار وظائف الأدمن:")
        
        # الحصول على لوحة تحكم الأدمن
        try:
            headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
            response = self.session.get(f"{BASE_URL}/admin/dashboard", headers=headers)
            if response.status_code == 200:
                print("✅ لوحة تحكم الأدمن تعمل")
            else:
                print(f"❌ لوحة تحكم الأدمن: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في لوحة تحكم الأدمن: {str(e)}")
        
        # الحصول على قائمة المستخدمين
        try:
            response = self.session.get(f"{BASE_URL}/admin/users", headers=headers)
            if response.status_code == 200:
                users = response.json()
                print(f"✅ قائمة المستخدمين: {len(users)} مستخدم")
            else:
                print(f"❌ قائمة المستخدمين: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في قائمة المستخدمين: {str(e)}")
        
        # الحصول على قائمة الشركاء
        try:
            response = self.session.get(f"{BASE_URL}/admin/partners", headers=headers)
            if response.status_code == 200:
                partners = response.json()
                print(f"✅ قائمة الشركاء: {len(partners)} شريك")
            else:
                print(f"❌ قائمة الشركاء: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في قائمة الشركاء: {str(e)}")
        
        # الحصول على الإحصائيات
        try:
            response = self.session.get(f"{BASE_URL}/admin/stats", headers=headers)
            if response.status_code == 200:
                stats = response.json()
                print(f"✅ الإحصائيات: {stats}")
            else:
                print(f"❌ الإحصائيات: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في الإحصائيات: {str(e)}")
    
    def test_partner_features(self):
        """اختبار وظائف الشريك"""
        print("\n🏭 اختبار وظائف الشريك:")
        
        headers = {"Authorization": f"Bearer {self.tokens['partner']}"}
        
        # الحصول على لوحة تحكم الشريك
        try:
            response = self.session.get(f"{BASE_URL}/partner/dashboard", headers=headers)
            if response.status_code == 200:
                print("✅ لوحة تحكم الشريك تعمل")
            else:
                print(f"❌ لوحة تحكم الشريك: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في لوحة تحكم الشريك: {str(e)}")
        
        # الحصول على معدات الشريك
        try:
            response = self.session.get(f"{BASE_URL}/partner/equipment", headers=headers)
            if response.status_code == 200:
                equipment = response.json()
                print(f"✅ معدات الشريك: {len(equipment)} معدة")
            else:
                print(f"❌ معدات الشريك: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في معدات الشريك: {str(e)}")
        
        # الحصول على حجوزات الشريك
        try:
            response = self.session.get(f"{BASE_URL}/partner/bookings", headers=headers)
            if response.status_code == 200:
                bookings = response.json()
                print(f"✅ حجوزات الشريك: {len(bookings)} حجز")
            else:
                print(f"❌ حجوزات الشريك: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في حجوزات الشريك: {str(e)}")
        
        # الحصول على إيرادات الشريك
        try:
            response = self.session.get(f"{BASE_URL}/partner/revenue", headers=headers)
            if response.status_code == 200:
                revenue = response.json()
                print(f"✅ إيرادات الشريك: {revenue}")
            else:
                print(f"❌ إيرادات الشريك: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في إيرادات الشريك: {str(e)}")
    
    def test_customer_features(self):
        """اختبار وظائف العميل"""
        print("\n🛍️ اختبار وظائف العميل:")
        
        headers = {"Authorization": f"Bearer {self.tokens['customer']}"}
        
        # الحصول على لوحة تحكم العميل
        try:
            response = self.session.get(f"{BASE_URL}/customer/dashboard", headers=headers)
            if response.status_code == 200:
                print("✅ لوحة تحكم العميل تعمل")
            else:
                print(f"❌ لوحة تحكم العميل: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في لوحة تحكم العميل: {str(e)}")
        
        # البحث عن المعدات
        try:
            response = self.session.get(f"{BASE_URL}/equipment/search?q=معدات", headers=headers)
            if response.status_code == 200:
                equipment = response.json()
                print(f"✅ البحث عن المعدات: {len(equipment)} نتيجة")
            else:
                print(f"❌ البحث عن المعدات: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في البحث عن المعدات: {str(e)}")
        
        # الحصول على الفئات
        try:
            response = self.session.get(f"{BASE_URL}/categories", headers=headers)
            if response.status_code == 200:
                categories = response.json()
                print(f"✅ الفئات: {len(categories)} فئة")
            else:
                print(f"❌ الفئات: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في الفئات: {str(e)}")
        
        # الحصول على حجوزات العميل
        try:
            response = self.session.get(f"{BASE_URL}/customer/bookings", headers=headers)
            if response.status_code == 200:
                bookings = response.json()
                print(f"✅ حجوزات العميل: {len(bookings)} حجز")
            else:
                print(f"❌ حجوزات العميل: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في حجوزات العميل: {str(e)}")
    
    def test_insurance_service(self):
        """اختبار خدمة التأمين"""
        print("\n🛡️ اختبار خدمة التأمين:")
        
        headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
        
        # إنشاء بوليصة تأمين
        try:
            policy_data = {
                "equipmentId": "test-equipment-id",
                "type": "basic",
                "coverage": {
                    "damage": 80,
                    "theft": 90,
                    "liability": 70,
                    "delay": 50
                },
                "premium": 50000,
                "deductible": 10000,
                "startDate": "2026-04-06T00:00:00Z",
                "endDate": "2026-07-06T00:00:00Z"
            }
            response = self.session.post(f"{BASE_URL}/insurance/policies", json=policy_data, headers=headers)
            if response.status_code == 200:
                print("✅ إنشاء بوليصة تأمين بنجاح")
            else:
                print(f"❌ إنشاء بوليصة تأمين: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في إنشاء بوليصة تأمين: {str(e)}")
        
        # الحصول على بوليصات التأمين
        try:
            response = self.session.get(f"{BASE_URL}/insurance/policies", headers=headers)
            if response.status_code == 200:
                policies = response.json()
                print(f"✅ بوليصات التأمين: {len(policies)} بوليصة")
            else:
                print(f"❌ بوليصات التأمين: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في بوليصات التأمين: {str(e)}")
    
    def test_support_service(self):
        """اختبار خدمة الدعم"""
        print("\n🆘 اختبار خدمة الدعم:")
        
        headers = {"Authorization": f"Bearer {self.tokens['customer']}"}
        
        # إنشاء تذكرة دعم
        try:
            ticket_data = {
                "category": "technical",
                "priority": "medium",
                "subject": "مشكلة في البحث",
                "description": "لا يمكنني البحث عن المعدات بشكل صحيح"
            }
            response = self.session.post(f"{BASE_URL}/support/tickets", json=ticket_data, headers=headers)
            if response.status_code == 200:
                print("✅ إنشاء تذكرة دعم بنجاح")
            else:
                print(f"❌ إنشاء تذكرة دعم: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في إنشاء تذكرة دعم: {str(e)}")
        
        # الحصول على تذاكر الدعم
        try:
            response = self.session.get(f"{BASE_URL}/support/tickets", headers=headers)
            if response.status_code == 200:
                tickets = response.json()
                print(f"✅ تذاكر الدعم: {len(tickets)} تذكرة")
            else:
                print(f"❌ تذاكر الدعم: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في تذاكر الدعم: {str(e)}")
    
    def test_contract_service(self):
        """اختبار خدمة العقود"""
        print("\n📄 اختبار خدمة العقود:")
        
        headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
        
        # إنشاء عقد
        try:
            contract_data = {
                "bookingId": "test-booking-id",
                "equipmentId": "test-equipment-id",
                "customerId": "test-customer-id",
                "ownerId": "test-owner-id",
                "type": "rental",
                "totalAmount": 100000,
                "currency": "IQD",
                "startDate": "2026-04-06T00:00:00Z",
                "endDate": "2026-04-13T00:00:00Z"
            }
            response = self.session.post(f"{BASE_URL}/contracts", json=contract_data, headers=headers)
            if response.status_code == 200:
                print("✅ إنشاء عقد بنجاح")
            else:
                print(f"❌ إنشاء عقد: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في إنشاء عقد: {str(e)}")
        
        # الحصول على العقود
        try:
            response = self.session.get(f"{BASE_URL}/contracts", headers=headers)
            if response.status_code == 200:
                contracts = response.json()
                print(f"✅ العقود: {len(contracts)} عقد")
            else:
                print(f"❌ العقود: {response.status_code}")
        except Exception as e:
            print(f"❌ خطأ في العقود: {str(e)}")
    
    def run_complete_test(self):
        """تشغيل الاختبار الكامل"""
        print("🚀 بدء الاختبار الشامل للنظام العراقي المتكامل")
        print("=" * 60)
        
        # الخطوة 1: تسجيل الدخول كـ Admin
        print("\n🔐 الخطوة 1: تسجيل الدخول كـ Admin")
        if self.login(ADMIN_USER, 'admin'):
            self.test_admin_features()
            self.test_insurance_service()
            self.test_support_service()
            self.test_contract_service()
        
        # الخطوة 2: تسجيل الخروج والدخول كـ Partner
        print("\n🔄 الخطوة 2: تسجيل الخروج والدخول كـ Partner")
        if self.login(PARTNER_USER, 'partner'):
            self.test_partner_features()
        
        # الخطوة 3: تسجيل الخروج والدخول كـ Customer
        print("\n🔄 الخطوة 3: تسجيل الخروج والدخول كـ Customer")
        if self.login(CUSTOMER_USER, 'customer'):
            self.test_customer_features()
        
        # الخطوة 4: العودة كـ Partner
        print("\n🔄 الخطوة 4: العودة كـ Partner")
        if self.login(PARTNER_USER, 'partner'):
            self.test_partner_features()
        
        # الخطوة 5: العودة كـ Customer
        print("\n🔄 الخطوة 5: العودة كـ Customer")
        if self.login(CUSTOMER_USER, 'customer'):
            self.test_customer_features()
        
        # الخطوة 6: العودة كـ Admin
        print("\n🔄 الخطوة 6: العودة كـ Admin")
        if self.login(ADMIN_USER, 'admin'):
            self.test_admin_features()
        
        print("\n" + "=" * 60)
        print("🎉 انتهى الاختبار الشامل للنظام!")

# تشغيل الاختبار
if __name__ == "__main__":
    tester = SystemTester()
    tester.run_complete_test()
