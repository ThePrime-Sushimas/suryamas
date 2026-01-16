#!/usr/bin/env python3
"""
Generate COA seed SQL for restaurant company
Reads from Excel-like data and generates proper SQL with UUID parent references
"""

COMPANY_ID = '3576839e-d83a-4061-8551-fe9b5d971111'
USER_ID = '8a130a3e-0490-48b9-abe5-769af0dee345'

# COA data: (code, level, name)
COA_DATA = [
    ('100000', 1, 'Asset'),
    ('110000', 2, 'Current asset'),
    ('110100', 3, 'Cash'),
    ('110101', 4, 'Petty cash HO'),
    ('110102', 4, 'Petty cash outlet'),
    ('110200', 3, 'Bank'),
    ('110201', 4, 'Bank 1'),
    ('110202', 4, 'Bank 2'),
    ('110300', 3, 'Restaurant sales receivables'),
    ('110301', 4, 'Cash sales receivable'),
    ('110302', 4, 'Credit card sales receivable'),
    ('110303', 4, 'Debit card sales receivable'),
    ('110304', 4, 'OVO sales receivable'),
    ('110305', 4, 'Shopeepay sales receivable'),
    ('110306', 4, 'Grab merchant sales receivable'),
    ('110307', 4, 'Gopay sales receivable'),
    ('110308', 4, 'Goresto sales receivable'),
    ('110309', 4, 'Shopeefood sales receivable'),
    ('110310', 4, 'Self Order sales receivable'),
    ('110400', 3, 'Account receivables'),
    ('110401', 4, 'B2B sales receivables'),
    ('110500', 3, 'Inventory'),
    ('110501', 4, 'Raw material'),
    ('110502', 4, 'WIP'),
    ('110503', 4, 'Kitchenware & supplies'),
    ('110598', 4, 'Inventory in transit'),
    ('110599', 4, 'Inventory in production'),
    ('110600', 3, 'Prepaid expenses'),
    ('110601', 4, 'Prepaid rent'),
    ('110602', 4, 'Prepaid other'),
    ('110603', 4, 'Prepaid tax'),
    ('110700', 3, 'Advances'),
    ('110701', 4, 'Advance to suppliers'),
    ('110800', 3, 'Suspense Account - Debit'),
    ('110801', 4, 'Debit suspense account'),
    ('110802', 4, 'Release payment account'),
    ('120000', 2, 'Non current asset'),
    ('120100', 3, 'Fixed asset'),
    ('120101', 4, 'Building'),
    ('120102', 4, 'Renovation'),
    ('120103', 4, 'Equipment'),
    ('120104', 4, 'Vehicle'),
    ('120105', 4, 'Asset in transit'),
    ('120200', 3, 'Accumulated depreciation'),
    ('120201', 4, 'Acc. Depr - Building'),
    ('120202', 4, 'Acc. Depr - Renovation'),
    ('120203', 4, 'Acc. Depr - Equipment'),
    ('120204', 4, 'Acc. Depr - Vehicle'),
    ('120300', 3, 'Investment'),
    ('120301', 4, 'Investment in PT AAA'),
    ('120400', 3, 'Security deposit'),
    ('120401', 4, 'Rental deposit'),
    ('200000', 1, 'Liability'),
    ('210000', 2, 'Current liability'),
    ('210100', 3, 'Account payable'),
    ('210101', 4, 'Account payable purchase'),
    ('210200', 3, 'Tax payable'),
    ('210201', 4, 'PPh 21'),
    ('210202', 4, 'PPh 23'),
    ('210203', 4, 'PPh 25'),
    ('210204', 4, 'PPh 26'),
    ('210205', 4, 'PPh 4 - 2'),
    ('210206', 4, 'Pb1 payable'),
    ('210207', 4, 'PPh 29'),
    ('210208', 4, 'PPN'),
    ('210209', 4, 'Other tax'),
    ('210300', 3, 'Accrued expense reserve'),
    ('210301', 4, 'Salary payable'),
    ('210302', 4, 'Utilities payable'),
    ('210303', 4, 'Professional fees payable'),
    ('210304', 4, 'Breakage Fund'),
    ('210305', 4, 'Service charge fees'),
    ('210306', 4, 'Other accrued expenses'),
    ('210400', 3, 'Restaurant Other Payable'),
    ('210401', 4, 'Restaurant service charge payable'),
    ('210402', 4, 'Member Deposit'),
    ('210403', 4, 'Delivery cost payable'),
    ('210404', 4, 'Voucher payable'),
    ('210500', 3, 'Other current payable'),
    ('210501', 4, 'Customer deposit'),
    ('210502', 4, 'Franchise'),
    ('210503', 4, 'Royalty'),
    ('210504', 4, 'Bank loan - short term'),
    ('210505', 4, 'Others'),
    ('210600', 3, 'Suspense Account - Credit'),
    ('210601', 4, 'Credit Suspense Account'),
    ('220000', 2, 'Non current liability'),
    ('220100', 3, 'Shareholders loan'),
    ('220101', 4, 'Loan from Shareholder A'),
    ('220200', 3, 'Bank Loan'),
    ('220201', 4, 'Bank loan - long term'),
    ('220300', 3, 'Other non current payable'),
    ('220301', 4, 'AP suspense'),
    ('300000', 1, 'Equity'),
    ('310000', 2, 'Shareholders equity'),
    ('310100', 3, 'Share capital'),
    ('310101', 4, 'Shares A'),
    ('310200', 3, 'Accumulated earnings'),
    ('310201', 4, 'RE previous period'),
    ('310202', 4, 'RE current period'),
    ('310300', 3, 'Dividend'),
    ('310301', 4, 'Dividend disbursement'),
    ('310400', 3, 'Beginning Balance'),
    ('310401', 4, 'Opening balance'),
    ('310500', 3, 'Other equity'),
    ('310501', 4, 'Additional paid in capital'),
    ('400000', 1, 'Revenue'),
    ('410000', 2, 'Revenue From Business'),
    ('410100', 3, 'Revenue From Restaurant'),
    ('410101', 4, 'Sales - Food'),
    ('410102', 4, 'Sales - Beverage'),
    ('410103', 4, 'Sales - Other'),
    ('410104', 4, 'Sales - Order fee'),
    ('410200', 3, 'Revenue From Non Restaurant Sales'),
    ('410201', 4, 'Sales - Material'),
    ('410300', 3, 'Discount'),
    ('410301', 4, 'Bill Discount'),
    ('410302', 4, 'Food Discount'),
    ('410303', 4, 'Beverage Discount'),
    ('410304', 4, 'Material Sales Discount'),
    ('410305', 4, 'Other Discount'),
    ('410400', 3, 'Other Business Revenue'),
    ('410401', 4, 'Other Revenue/Income'),
    ('500000', 1, 'Cost Of Sales'),
    ('510000', 2, 'Material Usage'),
    ('510100', 3, 'COGS Restaurant'),
    ('510101', 4, 'COGS - Food'),
    ('510102', 4, 'COGS - Beverage'),
    ('510103', 4, 'COGS - Other'),
    ('510200', 3, 'COGS Non-Restaurant'),
    ('510201', 4, 'COGS - Material Sold'),
    ('510300', 3, 'COGS Adjustments'),
    ('510301', 4, 'COGS Variance'),
    ('510302', 4, 'COGS Minus Resolve Variance'),
    ('600000', 1, 'Expenses'),
    ('610000', 2, 'Operating Expense'),
    ('610100', 3, 'Selling Expense'),
    ('610101', 4, 'Advertisement & Promotion Exp'),
    ('610102', 4, 'MDR Expenses'),
    ('610103', 4, 'Entertainment'),
    ('610200', 3, 'Employee Expenses'),
    ('610201', 4, 'Salary'),
    ('610202', 4, 'THR'),
    ('610203', 4, 'Employee Income Tax'),
    ('610204', 4, 'Casual Labour'),
    ('610205', 4, 'BPJS'),
    ('610206', 4, 'Staff Welfare'),
    ('610300', 3, 'Premise Expenses'),
    ('610301', 4, 'Eating House Rental'),
    ('610302', 4, 'Utilities'),
    ('610303', 4, 'Electricity Cost'),
    ('610304', 4, 'Water Cost'),
    ('610305', 4, 'Gas Cost'),
    ('610306', 4, 'Cleaning & Up Keep Shop'),
    ('610307', 4, 'Washe/Spoil'),
    ('610400', 3, 'Transportation Expenses'),
    ('610401', 4, 'Freight Charges'),
    ('610402', 4, 'Delivery/Handling'),
    ('610403', 4, 'Travelling & Accommodation'),
    ('610500', 3, 'Services Expenses'),
    ('610501', 4, 'Professional fees'),
    ('610502', 4, 'Consultancy Expense'),
    ('610503', 4, 'License Expense'),
    ('610504', 4, 'Technology expenses'),
    ('610600', 3, 'Asset Maintenance Expenses'),
    ('610601', 4, 'Repair & Maintenance'),
    ('610700', 3, 'General Expenses'),
    ('610701', 4, 'Insurance'),
    ('610702', 4, 'Office expense'),
    ('610703', 4, 'Postage & Stamps'),
    ('610704', 4, 'Printing & Stationary'),
    ('610705', 4, 'Telecommunication'),
    ('610706', 4, 'Uniform'),
    ('610707', 4, 'Kitchenware & Related Cost'),
    ('610708', 4, 'Miscellaneous Expense'),
    ('620000', 2, 'Depreciation Expense'),
    ('620100', 3, 'Asset Depreciation Expense'),
    ('620101', 4, 'Depr - Building'),
    ('620102', 4, 'Depr - Renovation'),
    ('620103', 4, 'Depr - Equipment'),
    ('620104', 4, 'Depr - Vehicle'),
    ('700000', 1, 'Others - non operating'),
    ('710000', 2, 'Non operating income/(expenses)'),
    ('710100', 3, 'Non Operating Income / Expense - net'),
    ('710101', 4, 'Asset Sales Gain or Losses/ Asset Revaluation'),
    ('710102', 4, 'Foreign Exchange Gain/(Loss)'),
    ('710103', 4, 'Interest Income/(expense)'),
    ('710104', 4, 'Bank Charges'),
    ('710105', 4, 'PB 1 Income'),
    ('710106', 4, 'Tax expenses'),
    ('710107', 4, 'Investment income'),
    ('710108', 4, 'Service charge income'),
    ('710109', 4, 'Miscellaneous Income/(Expense)'),
    ('710110', 4, 'Rounding/ POS Adjustment'),
    ('710200', 3, 'Corporate Tax'),
    ('710201', 4, 'Final Tax'),
]

def get_account_type(code):
    first_digit = code[0]
    return {
        '1': 'ASSET',
        '2': 'LIABILITY',
        '3': 'EQUITY',
        '4': 'REVENUE',
        '5': 'EXPENSE',
        '6': 'EXPENSE',
        '7': 'EXPENSE'
    }[first_digit]

def get_normal_balance(code):
    first_digit = code[0]
    return 'DEBIT' if first_digit in ['1', '5', '6', '7'] else 'CREDIT'

def get_parent_code(code, level):
    if level == 1:
        return None
    if level == 2:
        return code[0] + '00000'
    if level == 3:
        return code[:2] + '0000'
    if level == 4:
        return code[:4] + '00'
    return None

print(f"""-- COA Seed for Restaurant Company
-- Generated automatically
-- Company ID: {COMPANY_ID}
-- User ID: {USER_ID}

DELETE FROM chart_of_accounts WHERE company_id = '{COMPANY_ID}';
""")

# Group by level
by_level = {}
for code, level, name in COA_DATA:
    if level not in by_level:
        by_level[level] = []
    by_level[level].append((code, name))

# Generate SQL for each level
for level in sorted(by_level.keys()):
    accounts = by_level[level]
    is_header = level < 4
    is_postable = level == 4
    
    print(f"-- Level {level}: {'Header' if is_header else 'Detail'} accounts")
    
    for code, name in accounts:
        account_type = get_account_type(code)
        normal_balance = get_normal_balance(code)
        parent_code = get_parent_code(code, level)
        
        if parent_code:
            parent_clause = f"(SELECT id FROM chart_of_accounts WHERE account_code = '{parent_code}' AND company_id = '{COMPANY_ID}')"
        else:
            parent_clause = "NULL"
        
        # Escape single quotes in name
        safe_name = name.replace("'", "''")
        
        print(f"INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)")
        print(f"VALUES ('{COMPANY_ID}', '{code}', '{safe_name}', '{account_type}', {parent_clause}, {level}, {str(is_header).lower()}, {str(is_postable).lower()}, '{normal_balance}', '{USER_ID}');")
        print()

print(f"-- Total: {len(COA_DATA)} accounts")
