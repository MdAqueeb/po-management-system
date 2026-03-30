from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import get_db

router = APIRouter()

@router.post("/vendors", response_model=schemas.Vendor)
def create_vendor(vendor: schemas.VendorCreate, db: Session = Depends(get_db)):
    db_vendor = models.Vendor(**vendor.model_dump())
    db.add(db_vendor)
    db.commit()
    db.refresh(db_vendor)
    return db_vendor

@router.get("/vendors", response_model=List[schemas.Vendor])
def read_vendors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    vendors = db.query(models.Vendor).offset(skip).limit(limit).all()
    return vendors

@router.post("/products", response_model=schemas.Product)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.get("/products", response_model=List[schemas.Product])
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    products = db.query(models.Product).offset(skip).limit(limit).all()
    return products

@router.post("/purchase-orders", response_model=schemas.PurchaseOrder, status_code=201)
def create_purchase_order(po: schemas.PurchaseOrderCreate, db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == po.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    try:
        # Create PO first to get ID
        db_po = models.PurchaseOrder(
            reference_no=po.reference_no,
            vendor_id=po.vendor_id,
            status=po.status
        )
        db.add(db_po)
        db.flush()

        total_amount = 0.0

        for item in po.items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product with id {item.product_id} not found")
            
            price = item.price if item.price is not None else product.unit_price
            
            item_total = price * item.quantity
            total_amount += item_total

            db_item = models.PurchaseOrderItem(
                po_id=db_po.id,
                product_id=product.id,
                quantity=item.quantity,
                price=price
            )
            db.add(db_item)

        final_total = total_amount + (total_amount * 0.05)
        
        db_po.total_amount = final_total
        
        db.commit()
        db.refresh(db_po)
        
        return db_po

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/purchase-orders", response_model=List[schemas.PurchaseOrder])
def read_purchase_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    pos = db.query(models.PurchaseOrder).offset(skip).limit(limit).all()
    return pos

@router.put("/purchase-orders/{po_id}", response_model=schemas.PurchaseOrder)
def update_purchase_order_status(po_id: int, status_update: schemas.PurchaseOrderUpdate, db: Session = Depends(get_db)):
    db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    db_po.status = status_update.status
    db.commit()
    db.refresh(db_po)
    return db_po

@router.delete("/purchase-orders/{po_id}", status_code=204)
def delete_purchase_order(po_id: int, db: Session = Depends(get_db)):
    db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    db.delete(db_po)
    db.commit()
    return None
