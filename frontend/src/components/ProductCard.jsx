import "./ProductCard.css";

import Heart from '../assets/heart.svg'
import Dislike from '../assets/dislike.svg';

export default function ProductCard({name, price, store, image, onDislike, onLike}) {
    return (
        <div className="product-card">
            <img className="product-card-image" src={image}></img>
            
            <div className="product-card-text">
                <h3>{name}</h3>
                {price && <h3>${price}</h3>}
            </div>

            <div className="product-card-store">
                <a href={store} target="_blank" rel="noreferrer">
                    View product
                </a>
            </div>

            <div className="product-card-like">
                <img className="product-card-dislike" src={Dislike} onClick={() => onDislike()}></img>
                <img className="product-card-heart" src={Heart} onClick={() => onLike()}></img>
            </div>
        </div>
    )
}