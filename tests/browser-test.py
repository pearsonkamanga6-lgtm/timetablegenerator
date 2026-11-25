from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 opts={'http_credentials':{'username':'school','password':'local-test-only'}}
 a=b.new_context(**opts).new_page(); c=b.new_context(**opts).new_page()
 errors=[]
 for page in (a,c):page.on('pageerror',lambda e:errors.append(str(e)))
 for page in (a,c):
  page.goto('http://127.0.0.1:8765/');expect(page.locator('#cloudStatus')).to_contain_text('Current revision 0')
 a.get_by_role('button',name='School Setup',exact=True).click();a.locator('#schoolName').fill('Browser integration school');a.locator('#setup').get_by_role('button',name='Save',exact=True).click();a.locator('#cloudSave').click();expect(a.locator('#cloudStatus')).to_contain_text('revision 1')
 c.locator('#cloudSave').click();expect(c.locator('#cloudStatus')).to_contain_text('Revision conflict');expect(c.locator('#cloudSave')).to_be_disabled()
 c.on('dialog',lambda d:d.accept());c.locator('#cloudOpen').click();expect(c.locator('#cloudStatus')).to_contain_text('Opened cloud revision 1');assert c.locator('#schoolName').input_value()=='Browser integration school'
 c.reload();expect(c.locator('#cloudStatus')).to_contain_text('Current revision 1');assert c.locator('#schoolName').input_value()=='Browser integration school'
 assert not errors,errors
 print('PASS: Two isolated Chromium browser sessions saved, rejected a stale write, reopened the newer timetable and retained it after reload. No browser JavaScript errors.')
 b.close()
