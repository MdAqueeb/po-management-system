from pydantic import BaseModel, Field
from typing import List, Optional
from models import POStatus

class VendorBase(BaseModel):
    name: str
    contact: str
    rating: float

class VendorCreate(VendorBase):
    pass

class Vendor(VendorBase):
    id: int

    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    sku: str
    unit_price: float
    stock_level: int

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int

    class Config:
        from_attributes = True

class PurchaseOrderItemBase(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    price: Optional[float] = Field(None, ge=0)

class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass

class PurchaseOrderItem(PurchaseOrderItemBase):
    id: int
    po_id: int
    price: float

    class Config:
        from_attributes = True

class PurchaseOrderBase(BaseModel):
    reference_no: str
    vendor_id: int
    status: POStatus = POStatus.PENDING

class PurchaseOrderUpdate(BaseModel):
    status: POStatus

class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[PurchaseOrderItemCreate]

class PurchaseOrder(PurchaseOrderBase):
    id: int
    total_amount: float
    items: List[PurchaseOrderItem] = []
    
    class Config:
        from_attributes = True
